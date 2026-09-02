import { z } from "zod";

/**
 * A closing balance is the one figure in the app allowed to be negative: an
 * overdraft is a real state, and refusing to accept it would make the month
 * unclosable for exactly the person the number would help most.
 */
export const monthCloseSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  closingBalance: z.coerce
    .number()
    .min(-1_000_000, "That does not look like a balance")
    .max(1_000_000_000, "That does not look like a balance"),
});

/** Null clears the cap and puts the user back on "ended the month ahead". */
export const unrecordedCapSchema = z.object({
  cap: z.coerce
    .number()
    .min(0, "A cap cannot be negative")
    .max(1_000_000, "That does not look like a cap")
    .nullable(),
});

/** Capped at 28 so the reading day exists in February. */
export const closeDaySchema = z.object({
  closeDay: z.coerce
    .number()
    .int()
    .min(1, "Pick a day between 1 and 28")
    .max(28, "Pick a day between 1 and 28"),
});
