import { categoryReadJsonSchema } from "@finance/core/category-read";
import type { MonthReadRequest, MonthReadSource } from "@finance/core/month-read";
import { monthReadConfigured, monthReadModel } from "@/lib/month-read/client";

/**
 * The writer for one category, reusing the month read's own configuration.
 *
 * There is exactly one Mistral key on this deployment and one model choice,
 * both read in `lib/month-read/client.ts`, and this does not read them a
 * second time — `monthReadModel` and `monthReadConfigured` are reused rather
 * than duplicated, so a key rotated or a model overridden in one place is
 * overridden in both. What is genuinely new here is the request: a category
 * read is a different `response_format` over a different, much smaller
 * prompt, so the network call and its failure handling are written out
 * again rather than parameterising the month read's — two adapters over one
 * `MonthReadSource` port, exactly as `buildCategoryReadPrompt` returns a
 * `MonthReadRequest` rather than a type of its own.
 *
 * Same discipline as the month read's adapter: the key never leaves the
 * server, the network call is injected for testability, `null` is an
 * ordinary outcome and never a throw, and a run of failures cools the
 * adapter down rather than hammering a struggling endpoint.
 */

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

/** Low, but not zero: pressing "write it again" should not return the same read. */
const TEMPERATURE = 0.2;

/**
 * A category read is two observations and two suggestions over nine figures
 * at most — a fraction of a month read's budget. Set generously all the
 * same, for the reason `month-read/client.ts` gives: a ceiling this low would
 * guard against nothing a genuine answer would ever approach, and a cut-off
 * answer is a paid call that produces nothing.
 */
const MAX_TOKENS = 900;

const TIMEOUT_MS = 20_000;

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000;

function apiKey(): string | null {
  return process.env.MISTRAL_API_KEY?.trim() || null;
}

/** Reused rather than re-read: one key, one deployment. */
export function categoryReadConfigured(): boolean {
  return monthReadConfigured();
}

export function categoryReadModel(): string {
  return monthReadModel();
}

export interface MistralCategoryReadSourceOptions {
  fetchCompletion?: (body: unknown, key: string) => Promise<unknown>;
  now?: () => number;
  failureThreshold?: number;
  cooldownMs?: number;
}

async function postToMistral(body: unknown, key: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      // The status, never the body: a provider error body can quote the
      // prompt back, and the prompt contains this person's figures.
      throw new Error(`Mistral answered ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What came back, or null.
 *
 * `null` covers every way of not getting an answer — no key, unreachable,
 * rate-limited, timed out, an answer that is not JSON — because the caller
 * does the same thing for all of them: leave the read that is already there
 * and say it could not be rewritten.
 */
export function createMistralCategoryReadSource(
  options: MistralCategoryReadSourceOptions = {},
): MonthReadSource {
  const fetchCompletion = options.fetchCompletion ?? postToMistral;
  const now = options.now ?? Date.now;
  const failureThreshold = options.failureThreshold ?? FAILURE_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? COOLDOWN_MS;

  let consecutiveFailures = 0;
  let cooldownUntil = 0;

  return {
    get model() {
      return categoryReadModel();
    },

    async write(request: MonthReadRequest) {
      const key = apiKey();
      if (!key) {
        return null;
      }

      if (now() < cooldownUntil) {
        return null;
      }

      try {
        const raw = await fetchCompletion(
          {
            model: categoryReadModel(),
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
            response_format: categoryReadJsonSchema(request.locale),
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.user },
            ],
          },
          key,
        );

        consecutiveFailures = 0;
        cooldownUntil = 0;
        return parseAnswer(raw);
      } catch (error) {
        // The status and the model, on the server, once — never the body,
        // which can quote the prompt back. See `month-read/client.ts` for
        // why this is worth keeping even though nothing downstream reads it.
        console.warn(
          `[category-read] no answer from ${categoryReadModel()}: ${
            error instanceof Error ? error.message : "unknown failure"
          }`,
        );
        consecutiveFailures += 1;
        if (consecutiveFailures >= failureThreshold) {
          cooldownUntil = now() + cooldownMs;
        }
        return null;
      }
    },
  };
}

/**
 * The JSON the model put in its message, or null.
 *
 * Only as far as "this is an object" — the shape is `verifyCategoryRead`'s
 * job, in core, where it is tested.
 */
function parseAnswer(raw: unknown): unknown | null {
  const content = (
    raw as {
      choices?: { message?: { content?: unknown } }[];
    }
  )?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
