/**
 * The messages here are keys, not sentences.
 *
 * A schema is built when this module loads, long before any request has a
 * language, so it cannot translate its own message. It emits a key and
 * whoever shows the failure resolves it — see `resolveMessage` in `../i18n/t`
 * for why that is safe for the ordinary errors sharing the same field.
 */
import { z } from "zod";

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "errors.nameRequired")
    .max(100, "errors.nameTooLong"),
});

export const deleteConfirmSchema = z.object({
  confirmation: z.literal("DELETE", {
    error: "errors.deleteConfirmation",
  }),
});
