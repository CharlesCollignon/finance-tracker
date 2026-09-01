import { z } from "zod";

export const transactionSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be positive"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(500).optional(),
});

export const updateTransactionSchema = transactionSchema.extend({
  id: z.string().uuid(),
});

/**
 * The quick-add sheet posts an object rather than a FormData, because it stays
 * open across saves and never navigates.
 */
export const quickTransactionSchema = transactionSchema.extend({
  tagIds: z.array(z.string().uuid()).optional(),
});

/** One row of a reviewed CSV import, as the user confirmed it. */
export const importedTransactionSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be positive"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  note: z.string().max(500).optional(),
});

/** Import batches are capped so one paste cannot lock up the request. */
export const importTransactionsSchema = z.object({
  rows: z
    .array(importedTransactionSchema)
    .min(1, "Nothing to import")
    .max(2000, "Import at most 2000 rows at a time"),
});

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  type: z.enum(["income", "expense", "savings", "investment"]),
  icon: z.string().max(50).optional(),
  countsTowardSummary: z.boolean().optional(),
});

const optionalIsoDate = z
  .union([
    z.literal(""),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  ])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

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
  /** Optional échéancier start (inclusive). Empty = open-ended. */
  startsOn: optionalIsoDate,
  /** Optional échéancier end (inclusive). Empty = open-ended. */
  endsOn: optionalIsoDate,
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

function applyScheduleRules(
  data: z.infer<typeof recurringCommonSchema>,
  ctx: z.RefinementCtx,
) {
  if (data.startsOn && data.endsOn && data.startsOn > data.endsOn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be on or after start date",
      path: ["endsOn"],
    });
  }
}

function applyRecurringRules(
  data: z.infer<typeof recurringCommonSchema>,
  ctx: z.RefinementCtx,
) {
  applyPricingRules(data, ctx);
  applyScheduleRules(data, ctx);
}

export const recurringTemplateSchema = z.discriminatedUnion("recurrence", [
  recurringCommonSchema
    .extend({
      recurrence: z.literal("monthly"),
      dayOfMonth: z.coerce.number().int().min(1).max(31),
    })
    .superRefine(applyRecurringRules),
  recurringCommonSchema
    .extend({
      recurrence: z.literal("weekly"),
      dayOfWeek: z.coerce.number().int().min(1).max(7),
    })
    .superRefine(applyRecurringRules),
  recurringCommonSchema
    .extend({
      recurrence: z.literal("yearly"),
      monthOfYear: z.coerce.number().int().min(1).max(12),
      dayOfMonth: z.coerce.number().int().min(1).max(31),
    })
    .superRefine(applyRecurringRules),
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

const uuidSchema = z.string().uuid();

/** Returns the UUID or null when the value is not a valid UUID. */
export function parseUuid(id: string): string | null {
  const parsed = uuidSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}
