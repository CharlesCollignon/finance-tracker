import {
  walletReadJsonSchema,
  type WalletReadRequest,
  type WalletReadSource,
} from "@finance/core/wallet-read";
import { monthReadModel } from "@/lib/month-read/client";

/**
 * Where a wallet read comes from.
 *
 * The same endpoint, key and model as the month read —
 * `lib/month-read/client.ts` is the template and this is a second instance of
 * it rather than a new integration. One key, one model; the Bearing's
 * arrangement was a third instance of the same template until it was retired
 * with the arranger.
 *
 * The house rules that file sets are obeyed rather than restated: the adapter
 * never throws, `null` means "no answer right now", an explicit
 * `AbortController` rather than `AbortSignal.timeout`, the provider's
 * response body is never logged because it can quote the prompt back, and
 * three consecutive failures put it to sleep instead of hammering a service
 * that is plainly unwell.
 *
 * What is asked of the model here is harder than a month read, and in a
 * specific way: it has to name an instrument from a closed catalogue rather
 * than the well-known one it half-remembers. That is the same class of
 * failure the month read's own comment records — putting a figure where the
 * name of a category belongs — and it is why `verifyWalletRead` treats an
 * uncatalogued ISIN as fatal for the whole read. The failure mode is a read
 * that does not appear, never a read that misnames a fund.
 */

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

/** Low, but not zero: pressing Review again should not return the same read. */
const TEMPERATURE = 0.2;

/**
 * Room for the largest answer the schema permits, and then some.
 *
 * A headline, four observations and four suggestions at 240 characters each,
 * every one of them carrying a basis array and four enum fields. Pretty
 * printed that is comfortably past a thousand tokens, and an answer cut off
 * mid-string fails `JSON.parse`, which reaches the caller as "no answer" — a
 * paid call that produces nothing and is then refunded. Set well above the
 * worst legal answer rather than close to the typical one.
 */
const MAX_TOKENS = 2000;

/** Long enough for an answer, short enough not to hold a press open. */
const TIMEOUT_MS = 30_000;

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000;

function apiKey(): string | null {
  return process.env.MISTRAL_API_KEY?.trim() || null;
}

export function walletReadModel(): string {
  return monthReadModel();
}

/**
 * Whether a read can be asked for at all.
 *
 * A boolean rather than the key, so the secret never crosses into anything
 * that renders. Absent key means the surface has no Review button — and the
 * look-through, its charges, its overlap findings and its own default target
 * are the whole page without one.
 */
export function walletReadConfigured(): boolean {
  return apiKey() !== null;
}

export interface WalletReadSourceOptions {
  /** The network call, injected so failure handling is testable. */
  fetchCompletion?: (body: unknown, key: string) => Promise<unknown>;
  now?: () => number;
  failureThreshold?: number;
  cooldownMs?: number;
}

async function postToMistral(body: unknown, key: string): Promise<unknown> {
  // An explicit controller rather than AbortSignal.timeout, matching the
  // other two adapters: a runtime without it would hang rather than fail.
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

export function createMistralWalletReadSource(
  options: WalletReadSourceOptions = {},
): WalletReadSource {
  const fetchCompletion = options.fetchCompletion ?? postToMistral;
  const now = options.now ?? Date.now;
  const failureThreshold = options.failureThreshold ?? FAILURE_THRESHOLD;
  const cooldownMs = options.cooldownMs ?? COOLDOWN_MS;

  let consecutiveFailures = 0;
  let cooldownUntil = 0;

  return {
    get model() {
      return walletReadModel();
    },

    async write(request: WalletReadRequest) {
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
            model: walletReadModel(),
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
            response_format: walletReadJsonSchema(request.locale),
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
        // The status and the model, on the server, once. Not the body. The
        // status alone is what separates "the provider was down" from "this
        // key is not entitled to the configured model", and without it both
        // reach the user as the same sentence.
        console.warn(
          `[wallet-read] no answer from ${walletReadModel()}: ${
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
 * Only as far as "this parsed" — the shape is `verifyWalletRead`'s job, in
 * core, where it is tested. Everything here is defensive unwrapping of the
 * envelope.
 */
function parseAnswer(raw: unknown): unknown | null {
  const content = (raw as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
