import { z } from "zod";
import { parseShareCountInput } from "../share-count";
import { isCryptoWallet } from "../crypto-holdings";

const optionalNumber = z
  .union([z.coerce.number().min(0, "Must be 0 or more"), z.literal("")])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalShareCount = z
  .union([z.string(), z.coerce.number(), z.literal("")])
  .optional()
  .transform((value, ctx) => {
    if (value === "" || value === undefined) {
      return null;
    }

    const parsed = parseShareCountInput(value);
    if (parsed === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a positive number (comma or dot for decimals)",
        path: [],
      });
      return z.NEVER;
    }

    return parsed;
  });

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
  .superRefine((data, ctx) => {
    const hasInstrument = Boolean(data.instrumentSymbol?.trim());
    const hasShares = data.shareCount !== null && data.shareCount > 0;
    const hasOverride = data.currentValue !== null;

    if (hasInstrument && !hasShares && !hasOverride) {
      const label = isCryptoWallet(data.wallet) ? "BTC" : "shares";
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Enter total ${label} held for live market value`,
        path: ["shareCount"],
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
