/**
 * The messages here are keys, not sentences.
 *
 * A schema is built when this module loads, long before any request has a
 * language, so it cannot translate its own message. It emits a key and
 * whoever shows the failure resolves it — see `resolveMessage` in `../i18n/t`
 * for why that is safe for the ordinary errors sharing the same field.
 */
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
    .min(-1_000_000, "errors.notABalance")
    .max(1_000_000_000, "errors.notABalance"),
});

/** Null clears the cap and puts the user back on "ended the month ahead". */
export const unrecordedCapSchema = z.object({
  cap: z.coerce
    .number()
    .min(0, "errors.capNotNegative")
    .max(1_000_000, "errors.notACap")
    .nullable(),
});

/** Capped at 28 so the reading day exists in February. */
export const closeDaySchema = z.object({
  closeDay: z.coerce
    .number()
    .int()
    .min(1, "errors.pickDay")
    .max(28, "errors.pickDay"),
});
