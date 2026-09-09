import {
  arrangementJsonSchema,
  type ArrangementRequest,
  type ArrangementSource,
} from "@finance/core/bearing-read";
import { monthReadModel } from "@/lib/month-read/client";

/**
 * The arranger, sharing the month read's key and model choice.
 *
 * One provider, one key, one place it is read. `MISTRAL_API_KEY` already
 * gates the month read and this is the same account making the same kind of
 * call, so a second variable would be two things to configure for one
 * capability — and a deployment with a writer but no arranger is not a state
 * anybody wants.
 *
 * Everything here follows `lib/month-read/client.ts`, which follows
 * `market/quote-source.ts`: `null` for "no answer right now" as an ordinary
 * outcome rather than a throw, the network call injected so failure handling
 * is testable, and a cooldown after repeated failures because hammering a
 * rate-limited endpoint is what keeps it rate-limited.
 *
 * It lives in `apps/web` rather than `packages/core` for the reason stated at
 * length over there: core is bundled into the phone, and a key referenced
 * from there would be `undefined` at best and shipped inside an app bundle at
 * worst.
 */

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

/**
 * Lower than the month read's 0.2, and deliberately.
 *
 * That call is writing prose, where a little variety is the difference
 * between a paragraph and a template. This one is ranking a closed list, and
 * variety in a ranking is just a screen that reshuffles itself for no reason
 * anybody can see. Not zero, because pressing "Rearrange" twice on an
 * unchanged position should not be a button that visibly does nothing.
 */
const TEMPERATURE = 0.1;

/**
 * Smaller than a month read's ceiling, because the answer is smaller.
 *
 * Twelve tiles with an id, a short caption and a basis is a few hundred
 * tokens pretty-printed. Set well above the worst legal answer rather than
 * close to the typical one — a truncated JSON answer is a paid call that
 * produces nothing.
 */
const MAX_TOKENS = 900;

/** Long enough for an answer, short enough not to hold a press open. */
const TIMEOUT_MS = 20_000;

/** Consecutive failures before backing off. */
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000;

function apiKey(): string | null {
  return process.env.MISTRAL_API_KEY?.trim() || null;
}

/**
 * Whether this deployment could arrange at all, for the UI to explain itself.
 *
 * Mirrors `monthReadConfigured()` and `bankFeedConfigured()`: a boolean the
 * interface may render, with the secret never crossing the boundary. False
 * means no button — never a broken one — and the surface still works,
 * because the app supplies its own ordering.
 */
export function arrangerConfigured(): boolean {
  return apiKey() !== null;
}

export interface MistralArrangerOptions {
  /** The network call, injected so failure handling is testable. */
  fetchCompletion?: (body: unknown, key: string) => Promise<unknown>;
  now?: () => number;
  failureThreshold?: number;
  cooldownMs?: number;
}

async function postToMistral(body: unknown, key: string): Promise<unknown> {
  // An explicit controller rather than AbortSignal.timeout, matching the
  // month read and the mobile bank client: a runtime without it would hang
  // rather than fail.
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
 * does the same thing for all of them: leave the arrangement that is already
 * there and say it could not be redone.
 */
export function createMistralArranger(
  options: MistralArrangerOptions = {},
): ArrangementSource {
  const fetchCompletion = options.fetchCompletion ?? postToMistral;
  const now = options.now ?? Date.now;
  const failureThreshold = options.failureThreshold ?? FAILURE_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? COOLDOWN_MS;

  let consecutiveFailures = 0;
  let cooldownUntil = 0;

  return {
    get model() {
      return monthReadModel();
    },

    async choose(request: ArrangementRequest) {
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
            model: monthReadModel(),
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
            response_format: arrangementJsonSchema(request.locale),
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
        // The status and the model, on the server, once. Not the body, which
        // can quote the prompt back. The status alone is what distinguishes a
        // provider outage from a key unentitled to the configured model, and
        // without it both reach the user as the same sentence.
        console.warn(
          `[bearing] no answer from ${monthReadModel()}: ${
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
 * Only as far as "this is an object" — the shape is `verifyArrangement`'s
 * job, in core, where it is tested. Everything here is defensive unwrapping
 * of the envelope.
 */
function parseAnswer(raw: unknown): unknown | null {
  const content = (
    raw as { choices?: { message?: { content?: unknown } }[] }
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
