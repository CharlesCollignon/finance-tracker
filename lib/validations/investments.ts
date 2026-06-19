import { z } from "zod";

const optionalNumber = z
  .union([z.coerce.number().min(0, "Must be 0 or more"), z.literal("")])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalShareCount = z
  .union([
    z.coerce.number().int().positive("Must be a positive whole number"),
    z.literal(""),
  ])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalText = z
  .string()
  .max(200)
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

const optionalSymbol = z
  .string()
  .max(32)
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

export const investmentPositionSchema = z
  .object({
    positionId: z.string().uuid().optional(),
    wallet: z.enum(["pea", "cto", "crypto"]),
    sourceType: z.enum(["recurring", "custom"]),
    recurringTemplateId: z.string().uuid().optional().or(z.literal("")),
    name: z.string().max(120).optional(),
    categoryId: z.string().uuid().optional().or(z.literal("")),
    initialBalance: z.coerce.number().min(0, "Must be 0 or more"),
    currentValue: optionalNumber,
    shareCount: optionalShareCount,
    instrumentSymbol: optionalSymbol,
    instrumentName: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "recurring") {
      if (!data.recurringTemplateId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pick a recurring item",
          path: ["recurringTemplateId"],
        });
      }
      return;
    }

    if (!data.name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Name is required for custom holdings",
        path: ["name"],
      });
    }
  })
  .transform((data) => ({
    positionId: data.positionId ?? null,
    wallet: data.wallet,
    sourceType: data.sourceType,
    recurringTemplateId:
      data.sourceType === "recurring" && data.recurringTemplateId
        ? data.recurringTemplateId
        : null,
    name: data.name?.trim() ?? "",
    categoryId:
      data.categoryId && data.categoryId !== "" ? data.categoryId : null,
    initialBalance: data.initialBalance,
    currentValue: data.currentValue,
    shareCount: data.shareCount,
    instrumentSymbol: data.instrumentSymbol,
    instrumentName: data.instrumentName,
  }));

export type InvestmentPositionInput = z.infer<typeof investmentPositionSchema>;
