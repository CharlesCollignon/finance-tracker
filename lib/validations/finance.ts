import { z } from "zod";

export const transactionSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be positive"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(500).optional(),
});

const recurringBaseSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  active: z.boolean().optional(),
});

export const recurringTemplateSchema = z.discriminatedUnion("recurrence", [
  recurringBaseSchema.extend({
    recurrence: z.literal("monthly"),
    dayOfMonth: z.coerce.number().int().min(1).max(31),
  }),
  recurringBaseSchema.extend({
    recurrence: z.literal("weekly"),
    dayOfWeek: z.coerce.number().int().min(1).max(7),
  }),
  recurringBaseSchema.extend({
    recurrence: z.literal("yearly"),
    monthOfYear: z.coerce.number().int().min(1).max(12),
    dayOfMonth: z.coerce.number().int().min(1).max(31),
  }),
]);

export const applyRecurringSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
