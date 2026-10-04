import "server-only";
import type { Locale } from "@finance/core/i18n/locale";
import { patience, sampling } from "./sampling";
import type { Writer } from "./writer";

/**
 * One adapter for every written read — the month, a category, the band's
 * order, the portfolio — whoever writes it.
 *
 * Mistral and OpenRouter speak the same chat-completions dialect, structured
 * output included, so what differs between Pluclair's key and a user's
 * account is the `Writer`: where to send, with which key, which model, and
 * what else the service wants. What differs between one read and another is
 * the `ReadSourceConfig`. Everything else — the request, the timeout, the
 * failure count and its cooldown, the envelope — is the same call.
 *
 * `null` covers every way of not getting an answer — unreachable,
 * rate-limited, timed out, an answer that is not JSON — because every caller
 * does the same thing for all of them: keep the read already there and say
 * this one could not be written.
 */

export interface ReadSourceConfig {
  /** Built from the request's own language, as `response_format`. */
  responseFormat: (locale: Locale) => unknown;
  /** See each caller's own comment for how this was measured. */
  maxTokens: number;
  /** Long enough for the model to answer, short enough not to hang a press. */
  timeoutMs: number;
  /** Names this read in its warnings, so two failing at once read apart. */
  logPrefix: string;
}

/** What a read asks: the two messages, and the language they are in. */
export interface ReadRequest {
  system: string;
  user: string;
  locale: Locale;
}

/** A read's source for one writer: what it answered, and who answered. */
export interface ReadSource {
  write(request: ReadRequest): Promise<unknown | null>;
  readonly model: string;
}

/** Failures in a row, and the door closed after too many. */
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000;
const breakers = new Map<string, { failures: number; closedUntil: number }>();

export interface ReadSourceOptions {
  /** The network call, injected so failure handling is testable. */
  post?: (writer: Writer, body: unknown, timeoutMs: number) => Promise<unknown>;
  now?: () => number;
}

async function postCompletion(
  writer: Writer,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  // An explicit controller rather than AbortSignal.timeout: a runtime
  // without it would hang rather than fail.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(writer.endpoint, {
      method: "POST",
      headers: {
        ...writer.headers,
        Authorization: `Bearer ${writer.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      // The status, never the body: a provider's error body can quote the
      // prompt back, and the prompt holds this person's figures.
      throw new Error(`answered ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** The JSON the model put in its message, or null. The shape is core's to check. */
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

export function readSource(
  config: ReadSourceConfig,
  writer: Writer,
  options: ReadSourceOptions = {},
): ReadSource {
  const post = options.post ?? postCompletion;
  const now = options.now ?? Date.now;
  const breakerKey = `${config.logPrefix}:${writer.label}`;

  return {
    model: writer.model,

    async write(request) {
      const breaker = breakers.get(breakerKey) ?? {
        failures: 0,
        closedUntil: 0,
      };
      if (now() < breaker.closedUntil) {
        return null;
      }

      try {
        const raw = await post(
          writer,
          {
            ...writer.extra,
            model: writer.model,
            ...sampling(writer, config.maxTokens),
            response_format: config.responseFormat(request.locale),
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.user },
            ],
          },
          patience(writer, config.timeoutMs),
        );
        breakers.delete(breakerKey);
        return parseAnswer(raw);
      } catch (error) {
        // The status and the model, on the server, once — never the body.
        // The status alone is what says whether the provider was down, the
        // key unentitled to the model, or the account out of credit.
        console.warn(
          `[${config.logPrefix}] no answer from ${writer.model} (${
            writer.kind
          }): ${error instanceof Error ? error.message : "unknown failure"}`,
        );
        const failures = breaker.failures + 1;
        breakers.set(breakerKey, {
          failures,
          closedUntil: failures >= FAILURE_THRESHOLD ? now() + COOLDOWN_MS : 0,
        });
        return null;
      }
    },
  };
}
