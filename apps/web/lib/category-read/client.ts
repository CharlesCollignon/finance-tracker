import { categoryReadJsonSchema } from "@finance/core/category-read";
import type { MonthReadSource } from "@finance/core/month-read";
import {
  createMistralReadSource,
  monthReadConfigured,
  type MistralSourceOptions,
} from "@/lib/month-read/client";

/**
 * The writer for one category: `createMistralReadSource`, fixed to this
 * surface's own schema and token ceiling.
 *
 * There is exactly one Mistral key, one model choice, one endpoint and one
 * failure/cooldown state machine on this deployment, all defined once in
 * `lib/month-read/client.ts`. Nothing here reads `MISTRAL_API_KEY` or makes
 * a network call of its own — an earlier version of this file did, and that
 * was two copies of the same adapter's failure path to keep in step, and a
 * comment here claiming the key was read once when it was in fact read in
 * two files.
 */

/**
 * A category read is two observations and two suggestions over nine figures
 * at most — a fraction of a month read's budget. Set generously all the
 * same, for the reason `month-read/client.ts` gives its own ceiling: a
 * ceiling this low would guard against nothing a genuine answer would ever
 * approach, and a cut-off answer is a paid call that produces nothing.
 */
const MAX_TOKENS = 900;

/** Reused rather than re-read: one key, one deployment. */
export function categoryReadConfigured(): boolean {
  return monthReadConfigured();
}

export function createMistralCategoryReadSource(
  options: MistralSourceOptions = {},
): MonthReadSource {
  return createMistralReadSource(
    {
      responseFormat: categoryReadJsonSchema,
      maxTokens: MAX_TOKENS,
      logPrefix: "category-read",
    },
    options,
  );
}
