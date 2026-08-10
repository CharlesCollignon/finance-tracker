import { z } from "zod";

export const budgetSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
});

export const walletTransferSchema = z.object({
  id: z.string().uuid().optional(),
  toWallet: z.enum(["pea", "cto", "crypto"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(500).optional(),
});

export const tagSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(40, "Name must be 40 characters or less"),
});

export const savingsGoalSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  targetAmount: z.coerce.number().positive("Target must be positive"),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional()
    .or(z.literal("")),
  categoryId: z.string().uuid().nullable().optional(),
});
