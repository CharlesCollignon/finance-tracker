import { categoryReadJsonSchema } from "@finance/core/category-read";
import type { ReadSourceConfig } from "@/lib/ai/read-source";

/**
 * A category read's request. A category read is two observations and two
 * suggestions over nine figures at most — a fraction of a month read's
 * budget — set generously all the same, for the reason the month read gives
 * its own ceiling: a cut-off answer is a paid call that produces nothing.
 */
export const CATEGORY_READ_SOURCE: ReadSourceConfig = {
  responseFormat: categoryReadJsonSchema,
  maxTokens: 900,
  timeoutMs: 20_000,
  logPrefix: "category-read",
};
