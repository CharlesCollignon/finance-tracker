import {
  MONTH_READ_JSON_SCHEMA,
  type MonthReadRequest,
  type MonthReadSource,
} from "@finance/core/month-read";

/**
 * The writer, and the only place its key exists.
 *
 * This lives in `apps/web` rather than in `packages/core` and the reason is
 * secrets, not networking — core does reach the network, in
 * `market/yahoo.ts`. Core is bundled into the phone, so a `MISTRAL_API_KEY`
 * referenced from there would be `undefined` at best and shipped inside an
 * app bundle at worst. Nothing that reads the key belongs on the other side
 * of that line, and the decision logic that does belong in core is already
 * there, tested, with no idea a provider exists.
 *
 * The key is read from the environment on the server and must never be sent
 * to a browser, logged, or returned from an action — the same discipline
 * `lib/bank/client.ts` states for the bank credentials bundle.
 *
 * The adapter follows `market/quote-source.ts`: `null` for "no answer right
 * now" as an ordinary outcome, never a throw, the network call injected so
 * failure handling is testable, and a cooldown after repeated failures
 * because hammering a rate-limited endpoint is what keeps it rate-limited.
 */

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

/**
 * Chosen on quality, because nothing else is a constraint.
 *
 * An earlier version of this comment argued for the smallest model that could
 * do the job — four sentences over two dozen labelled figures, constrained
 * writing rather than reasoning. That reasoning was answering a question
 * nobody asked. A read is about 1,400 tokens in and 740 out, capped at five
 * per user per month: around eleven thousand tokens a month, which is a few
 * cents at premier prices and a fraction of one at open-model prices. Cost
 * and throughput cannot decide this, so quality is all that is left, and the
 * default should be the best model that is sensible rather than the cheapest
 * that is adequate.
 *
 * Measured, on the same fact pack: the small open models write sentences that
 * do not parse — "your 720,00 € left over is 720,00 €" — and put a figure
 * where the name of a category belongs. That failure is characteristic of
 * small models and it is the one this prompt most needs a model not to have.
 *
 * `MISTRAL_MODEL` overrides this, and has to: Mistral's free plan entitles a
 * key to the open-weight ministral models only, and answers `429` or `403`
 * for these. On such a key set `ministral-14b-latest`.
 */
const DEFAULT_MODEL = "mistral-medium-latest";

/** Low, but not zero: pressing "write it again" should not return the same read. */
const TEMPERATURE = 0.2;

/**
 * Room for the largest answer the schema permits, and then some.
 *
 * Measured rather than guessed: at 700 a real answer came back cut off
 * mid-string, which `JSON.parse` rejects, which reaches the caller as "no
 * answer" — a paid call that produces nothing and is then refunded. The
 * schema allows a 90-character headline, four claims and three suggestions of
 * 240 characters each, each with its basis; pretty-printed as JSON that is
 * comfortably over a thousand tokens. This ceiling is a guard against a
 * runaway generation, not a way to keep the bill down, so it is set well
 * above the worst legal answer rather than close to the typical one.
 */
const MAX_TOKENS = 1600;

/** Long enough for an answer, short enough not to hold a press open. */
const TIMEOUT_MS = 20_000;

/** Consecutive failures before backing off. */
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000;

function apiKey(): string | null {
  return process.env.MISTRAL_API_KEY?.trim() || null;
}

export function monthReadModel(): string {
  return process.env.MISTRAL_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Whether this deployment could write a read at all, for the UI to explain
 * itself. Mirrors `bankFeedConfigured()`: a boolean the interface may render,
 * with the secret never crossing the boundary.
 */
export function monthReadConfigured(): boolean {
  return apiKey() !== null;
}

export interface MistralSourceOptions {
  /** The network call, injected so failure handling is testable. */
  fetchCompletion?: (body: unknown, key: string) => Promise<unknown>;
  now?: () => number;
  failureThreshold?: number;
  cooldownMs?: number;
}

async function postToMistral(body: unknown, key: string): Promise<unknown> {
  // An explicit controller rather than AbortSignal.timeout, matching the
  // mobile bank client: a runtime without it would hang rather than fail.
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
export function createMistralMonthReadSource(
  options: MistralSourceOptions = {},
): MonthReadSource {
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
            model: monthReadModel(),
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
            response_format: MONTH_READ_JSON_SCHEMA,
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
        // can quote the prompt back — but the status alone is what says
        // whether a read failed because the provider was down, because the
        // key is unentitled to the configured model, or because the month was
        // never eligible. Without it every one of those reaches the user as
        // the same sentence, and three separate diagnoses this week each
        // needed a hand-rolled probe to tell them apart.
        console.warn(
          `[month-read] no answer from ${monthReadModel()}: ${
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
 * Only as far as "this is an object" — the shape is `verifyMonthRead`'s job,
 * in core, where it is tested. Everything here is defensive unwrapping of the
 * envelope.
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
