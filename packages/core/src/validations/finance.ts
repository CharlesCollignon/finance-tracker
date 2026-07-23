import { z } from "zod";

export const transactionSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be positive"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(500).optional(),
});

const recurringCommonSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  active: z.boolean().optional(),
  pricingType: z.enum(["fixed", "shares"]).default("fixed"),
  amount: z.coerce.number().positive("Amount must be positive").optional(),
  shareCount: z.coerce.number().int().positive().optional(),
  instrumentSymbol: z.string().min(1).max(32).optional(),
  instrumentName: z.string().min(1).max(200).optional(),
});

function applyPricingRules(
  data: z.infer<typeof recurringCommonSchema>,
  ctx: z.RefinementCtx,
) {
  if (data.pricingType === "fixed") {
    if (!data.amount || data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be positive",
        path: ["amount"],
      });
    }
    return;
  }

  if (!data.shareCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Share count is required",
      path: ["shareCount"],
    });
  }

  if (!data.instrumentSymbol) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select an ETF from the search results",
      path: ["instrumentSymbol"],
    });
  }

  if (!data.instrumentName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select an ETF from the search results",
      path: ["instrumentName"],
    });
  }
}

export const recurringTemplateSchema = z.discriminatedUnion("recurrence", [
  recurringCommonSchema
    .extend({
      recurrence: z.literal("monthly"),
      dayOfMonth: z.coerce.number().int().min(1).max(31),
    })
    .superRefine(applyPricingRules),
  recurringCommonSchema
    .extend({
      recurrence: z.literal("weekly"),
      dayOfWeek: z.coerce.number().int().min(1).max(7),
    })
    .superRefine(applyPricingRules),
  recurringCommonSchema
    .extend({
      recurrence: z.literal("yearly"),
      monthOfYear: z.coerce.number().int().min(1).max(12),
      dayOfMonth: z.coerce.number().int().min(1).max(31),
    })
    .superRefine(applyPricingRules),
]);

export const applyRecurringSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type RecurringTemplateInput = z.infer<typeof recurringTemplateSchema>;
