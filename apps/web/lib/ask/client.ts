import { askAnswerJsonSchema, askPlanJsonSchema } from "@finance/core/ask";
import type { ReadSourceConfig } from "@/lib/ai/read-source";

/**
 * Ask Pluclair's two requests: their schemas, ceilings and patience. Who
 * answers — Pluclair's key or the person's AI account — is the writer's
 * business (`lib/ai/writer.ts`), and how it is sent the one adapter's.
 *
 * The plan is a handful of words; the answer at most four sentences with
 * their bases. Each ceiling sits well above the largest legal answer — it
 * guards a runaway generation, not the bill.
 */
export const ASK_PLAN_SOURCE: ReadSourceConfig = {
  responseFormat: askPlanJsonSchema,
  maxTokens: 300,
  timeoutMs: 12_000,
  logPrefix: "ask-plan",
};

export const ASK_ANSWER_SOURCE: ReadSourceConfig = {
  responseFormat: askAnswerJsonSchema,
  maxTokens: 900,
  timeoutMs: 20_000,
  logPrefix: "ask-answer",
};
