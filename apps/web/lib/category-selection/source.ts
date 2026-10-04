import { categorySelectionJsonSchema } from "@finance/core/category-selection";
import type { ReadSourceConfig } from "@/lib/ai/read-source";

/**
 * The band's order's request. The largest legal answer is five picks, each
 * an id of about forty characters and a remark of seventy: comfortably under
 * two hundred tokens. Set well above that rather than close to it, for the
 * reason the month read gives its own ceiling: a ceiling that cuts a genuine
 * answer off mid-string produces JSON that will not parse — a paid call that
 * produces nothing.
 */
export const CATEGORY_SELECTION_SOURCE: ReadSourceConfig = {
  responseFormat: categorySelectionJsonSchema,
  maxTokens: 500,
  timeoutMs: 20_000,
  logPrefix: "category-selection",
};
