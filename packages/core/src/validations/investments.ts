/**
 * The messages here are keys, not sentences.
 *
 * A schema is built when this module loads, long before any request has a
 * language, so it cannot translate its own message. It emits a key and
 * whoever shows the failure resolves it — see `resolveMessage` in `../i18n/t`
 * for why that is safe for the ordinary errors sharing the same field.
 */
import { z } from "zod";
import { parseShareCountInput } from "../share-count";
import { isCryptoWallet } from "../crypto-holdings";
import { parseChargeInput } from "../fund-costs";

/**
 * The closed set of wallets, in one place.
 *
 * It was written out four times — three here and once in `phase4.ts` — and
 * adding two wrappers in `030` meant finding all four. A named schema means
 * the next wrapper is one edit, and a missed site is a type error rather than
 * a form that silently rejects a valid wallet.
 */
export const walletIdSchema = z.enum(["pea", "cto", "av", "per", "crypto"]);

/**
 * A broker's figure for a holding, or nothing.
 *
 * Zero counts as nothing. The field is optional and labelled "usually leave
 * empty", so somebody typing 0 means "I have no override" — and taking that
 * literally valued the holding at zero euros, which is how a real position
 * disappeared from the dashboard. A holding genuinely worth nothing is a
 * holding to delete, so the literal reading has no legitimate use to protect.
 */
const optionalValue = z
  .union([z.coerce.number().min(0, "errors.zeroOrMore"), z.literal("")])
  .optional()
  .transform((value) =>
    value === "" || value === undefined || value === 0 ? null : value,
  );

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
        message: "errors.positiveNumber",
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

/**
 * The ongoing charge, typed the way it is written on a fund's KID — "0.20"
 * meaning 0.20% a year — and stored as the fraction 0.002. Rejecting anything
 * above 10% catches the common slip of entering 20 for 0.20%.
 */
const optionalCharge = z
  .union([z.string(), z.coerce.number(), z.literal("")])
  .optional()
  .transform((value, ctx) => {
    if (value === "" || value === undefined || value === null) {
      return null;
    }

    const parsed = parseChargeInput(String(value));
    if (parsed === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.chargeAsPercent",
        path: [],
      });
      return z.NEVER;
    }

    if (parsed > 0.1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.chargeTooHigh",
        path: [],
      });
      return z.NEVER;
    }

    return parsed;
  });

/**
 * An ISIN, or nothing.
 *
 * Upper-cased and shape-checked; the check digit is deliberately not
 * verified. A wrong one is something to explain to whoever typed it, and this
 * value almost always arrives from the instrument search rather than from a
 * person — so the useful behaviour is to normalise what is offered and refuse
 * only what cannot be an identifier at all.
 */
const optionalIsin = z
  .string()
  .max(20)
  .optional()
  .transform((value, ctx) => {
    const trimmed = value?.trim().toUpperCase();
    if (!trimmed) {
      return null;
    }
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(trimmed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.notAnIsin",
        path: [],
      });
      return z.NEVER;
    }
    return trimmed;
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
    wallet: walletIdSchema,
    sourceType: z.enum(["recurring", "custom"]),
    recurringTemplateId: z.string().uuid().optional().or(z.literal("")),
    name: z.string().max(120).optional(),
    categoryId: z.string().uuid().optional().or(z.literal("")),
    initialBalance: z.coerce.number().min(0, "errors.zeroOrMore"),
    currentValue: optionalValue,
    shareCount: optionalShareCount,
    /** Ongoing charge typed as a percentage ('0.20'), stored as a fraction. */
    ongoingCharge: optionalCharge,
    instrumentSymbol: optionalSymbol,
    instrumentName: optionalText,
    isin: optionalIsin,
    /** Checkbox: absent means unchecked, which means the market wins. */
    valuePinned: z
      .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("")])
      .optional()
      .transform((value) => value === true || value === "on" || value === "true"),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "recurring") {
      if (!data.recurringTemplateId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "errors.pickRecurring",
          path: ["recurringTemplateId"],
        });
      }
      return;
    }

    if (!data.name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.nameRequiredCustom",
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
    ongoingCharge: data.ongoingCharge,
    instrumentSymbol: data.instrumentSymbol,
    instrumentName: data.instrumentName,
    isin: data.isin,
    // Pinning nothing is meaningless, so a pin without a figure is dropped
    // rather than stored as a flag that can never take effect.
    valuePinned: data.currentValue === null ? false : data.valuePinned,
  }));

export type InvestmentPositionInput = z.infer<typeof investmentPositionSchema>;

/**
 * The user's intent for a wallet: how much of the portfolio it should hold,
 * and when the wrapper was opened (which starts a PEA's five-year clock).
 */
export const walletPlanSchema = z.object({
  wallet: walletIdSchema,
  /** Fraction of the portfolio, 0–1. Empty clears the target. */
  targetWeight: z
    .union([z.literal(""), z.coerce.number().min(0).max(1)])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  openedOn: z
    .union([
      z.literal(""),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.invalidDate"),
    ])
    .optional()
    .transform((value) => (value ? value : null)),
  contributionCeiling: z
    .union([z.literal(""), z.coerce.number().positive()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  /**
   * The envelope's own annual fee, typed as a percentage ('0.75') and stored
   * as the fraction 0.0075 — the same shape as a position's ongoing charge,
   * because the look-through adds the two together.
   */
  wrapperFee: optionalCharge,
});

/** Targets are set together, so they can be checked as a set. */
export const walletTargetsSchema = z.object({
  targets: z
    .array(
      z.object({
        wallet: walletIdSchema,
        targetWeight: z.coerce.number().min(0).max(1),
      }),
    )
    .max(5),
});
