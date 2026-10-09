import { monthReadJsonSchema } from "@finance/core/month-read";
import type { ReadSourceConfig } from "@/lib/ai/read-source";

/**
 * The month read's request: its schema, its ceiling, its patience. Who
 * answers it — the user's own AI account — is the writer's
 * business (`lib/ai/writer.ts`), and how it is sent is the one adapter's
 * (`lib/ai/read-source.ts`).
 *
 * Room for the largest answer the schema permits, and then some. Measured
 * rather than guessed: at 700 tokens a real answer came back cut off
 * mid-string, which `JSON.parse` rejects, which reaches the caller as "no
 * answer" — a paid call that produces nothing. The schema allows a
 * 90-character headline, four claims and three suggestions of 240
 * characters each, each with its basis; pretty-printed as JSON that is
 * comfortably over a thousand tokens. The ceiling guards against a runaway
 * generation, not the bill, so it sits well above the worst legal answer.
 */
export const MONTH_READ_SOURCE: ReadSourceConfig = {
  responseFormat: monthReadJsonSchema,
  maxTokens: 1600,
  timeoutMs: 20_000,
  logPrefix: "month-read",
};
