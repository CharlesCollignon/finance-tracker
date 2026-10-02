/**
 * A property and a loan, as either app's form hands them over.
 *
 * The messages here are keys, not sentences — see `./investments.ts` for
 * why. Amounts are read the way they are typed (« 250 000 », « 1 234,56 »),
 * and shares and rates are typed as percentages and stored as fractions:
 * « 50 » is half, « 3,5 » is 0.035.
 */
import { z } from "zod";
import { parseTypedAmount } from "../amount-input";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.invalidDate");

const name = z
  .string()
  .trim()
  .min(1, "errors.nameRequired")
  .max(80, "errors.nameTooLong");

/** An amount as typed, or a number; null when the field is empty. */
function typedAmount(message: string) {
  return z.union([z.number(), z.string()]).transform((value, ctx) => {
    if (typeof value === "number") {
      return value;
    }
    if (value.trim() === "") {
      return null;
    }
    const parsed = parseTypedAmount(value);
    if (parsed === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    }
    return parsed;
  });
}

/**
 * A percentage as typed, as a fraction; null when the field is empty.
 *
 * Not `parseTypedAmount`, which reads « 1,125 » as a thousand and more: a
 * rate is never grouped in thousands, so its separator is always a decimal.
 */
function typedPercent(message: string) {
  return z.union([z.number(), z.string()]).transform((value, ctx) => {
    if (typeof value === "number") {
      return value / 100;
    }
    const cleaned = value.replace(/[\s%]/g, "").replace(",", ".");
    if (cleaned === "") {
      return null;
    }
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    }
    return parsed / 100;
  });
}

const positiveAmount = typedAmount("errors.positiveNumber").pipe(
  z.number("errors.amountPositive").gt(0, "errors.amountPositive"),
);

/** Empty is nothing: fees nobody paid. */
const feeAmount = typedAmount("errors.positiveNumber")
  .transform((value) => value ?? 0)
  .pipe(z.number().min(0, "errors.zeroOrMore"));

/** More than nothing and at most all of it; empty is all of it. */
const share = typedPercent("errors.shareRange")
  .transform((value) => value ?? 1)
  .pipe(z.number().gt(0, "errors.shareRange").max(1, "errors.shareRange"));

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    });

export const propertySchema = z
  .object({
    id: z.string().uuid().optional(),
    name,
    kind: z.enum(["apartment", "house", "other"]),
    usage: z
      .enum(["main_home", "second_home", "rental_bare", "rental_furnished"])
      .default("main_home"),
    // Where it is, as the geocoder answered. All optional: a property can be
    // kept without a market to price it by.
    citycode: z
      .string()
      .regex(/^[0-9][0-9AB][0-9]{3}$/, "errors.invalidInput")
      .nullish()
      .transform((value) => value ?? null),
    postcode: z
      .string()
      .regex(/^[0-9]{5}$/, "errors.invalidInput")
      .nullish()
      .transform((value) => value ?? null),
    latitude: z
      .number()
      .min(-90)
      .max(90)
      .nullish()
      .transform((value) => value ?? null),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .nullish()
      .transform((value) => value ?? null),
    addressLabel: optionalText(200),
    livingArea: typedAmount("errors.positiveNumber").pipe(
      z.number().gt(0, "errors.areaRequired").max(100_000).nullable(),
    ),
    rooms: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .nullish()
      .transform((value) => value ?? null),
    ownershipShare: share,
    purchasedOn: isoDate,
    purchasePrice: positiveAmount,
    notaryFees: feeAmount,
    agencyFees: feeAmount,
    works: feeAmount,
  })
  .superRefine((data, ctx) => {
    // A home is priced by its area, so it has to have one.
    if (data.kind !== "other" && data.livingArea === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.areaRequired",
        path: ["livingArea"],
      });
    }
    if ((data.latitude === null) !== (data.longitude === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.invalidInput",
        path: ["longitude"],
      });
    }
  });

export const loanSchema = z
  .object({
    id: z.string().uuid().optional(),
    propertyId: z.string().uuid(),
    label: name,
    kind: z.enum(["amortising", "in_fine"]).default("amortising"),
    principal: positiveAmount,
    annualRate: typedPercent("errors.rateRange").pipe(
      z
        .number("errors.rateRange")
        .min(0, "errors.rateRange")
        .max(0.2, "errors.rateRange"),
    ),
    months: z.coerce
      .number("errors.monthsRange")
      .int("errors.monthsRange")
      .min(1, "errors.monthsRange")
      .max(600, "errors.monthsRange"),
    firstPaymentOn: isoDate,
    insuranceMonthly: feeAmount,
    /** Yearly, on what is still owed. Empty when the insurance is monthly. */
    insuranceRate: typedPercent("errors.insuranceRateRange").pipe(
      z
        .number()
        .min(0, "errors.insuranceRateRange")
        .max(0.05, "errors.insuranceRateRange")
        .nullable(),
    ),
    deferralKind: z.enum(["none", "partial", "total"]).default("none"),
    deferralMonths: z.coerce.number().int().min(0).default(0),
    fees: feeAmount,
    borrowerShare: share,
  })
  .transform((data) =>
    data.deferralKind === "none" ? { ...data, deferralMonths: 0 } : data,
  )
  .superRefine((data, ctx) => {
    if (data.insuranceRate !== null && data.insuranceMonthly > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.insuranceOneWay",
        path: ["insuranceRate"],
      });
    }
    if (data.deferralKind === "none") {
      return;
    }
    if (data.kind === "in_fine") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.inFineNoDeferral",
        path: ["deferralKind"],
      });
    } else if (data.deferralMonths === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.deferralMonthsRequired",
        path: ["deferralMonths"],
      });
    } else if (data.deferralMonths >= data.months) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errors.deferralTooLong",
        path: ["deferralMonths"],
      });
    }
  });
