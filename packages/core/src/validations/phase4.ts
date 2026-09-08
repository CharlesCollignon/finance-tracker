/**
 * The messages here are keys, not sentences.
 *
 * A schema is built when this module loads, long before any request has a
 * language, so it cannot translate its own message. It emits a key and
 * whoever shows the failure resolves it — see `resolveMessage` in `../i18n/t`
 * for why that is safe for the ordinary errors sharing the same field.
 */
import { z } from "zod";

export const budgetSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive("errors.amountPositive"),
});

export const walletTransferSchema = z.object({
  id: z.string().uuid().optional(),
  toWallet: z.enum(["pea", "cto", "crypto"]),
  amount: z.coerce.number().positive("errors.amountPositive"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.invalidDate"),
  note: z.string().max(500).optional(),
});

export const tagSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "errors.nameRequired")
    .max(40, "errors.nameTooLong40"),
});

export const savingsGoalSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "errors.nameRequired")
    .max(100, "errors.nameTooLong100"),
  targetAmount: z.coerce.number().positive("errors.targetPositive"),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "errors.invalidDate")
    .optional()
    .or(z.literal("")),
  categoryId: z.string().uuid().nullable().optional(),
});
