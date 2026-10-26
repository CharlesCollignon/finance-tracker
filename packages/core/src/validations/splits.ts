import { z } from "zod";

/** How many parts one payment may be split into. */
export const SPLIT_PARTS_MAX = 10;

/**
 * One payment in several parts, as either app's editor hands it over: the
 * row to split, and each part's amount, category and words. The parts must
 * add up to the row, which the write checks against the row as stored.
 */
export const splitSchema = z.object({
  id: z.string().uuid(),
  parts: z
    .array(
      z.object({
        amount: z.coerce.number().positive("errors.amountPositive"),
        categoryId: z.string().uuid("errors.pickCategory"),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .min(2, "transaction.splitTwoParts")
    .max(SPLIT_PARTS_MAX, "transaction.splitTooMany"),
});

export type SplitInput = z.input<typeof splitSchema>;
