import { z } from "zod";
import { RULE_WORDS_MAX, RULE_WORDS_MIN } from "../filing-rules";

/**
 * A filing rule as either app's form hands it over. The messages are keys,
 * as in `./finance`.
 */
export const filingRuleSchema = z.object({
  words: z
    .string()
    .trim()
    .min(RULE_WORDS_MIN, "rules.wordsTooShort")
    .max(RULE_WORDS_MAX, "rules.wordsTooLong"),
  categoryId: z.string().uuid(),
  direction: z.enum(["in", "out"]).default("out"),
  /** The line the rule was written from, for the list to say so. */
  createdFrom: z.string().trim().max(200).optional(),
});

export type FilingRuleInput = z.input<typeof filingRuleSchema>;
