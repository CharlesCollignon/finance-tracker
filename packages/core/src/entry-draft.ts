import type { MerchantRule } from "./merchant-memory";
import { monthsEvery, type MonthSet } from "./recurrence";
import type { Category, CategoryType, Recurrence } from "./types/database";

/**
 * What the Add sheet asks before anything else: which kind of money this is.
 *
 * The sheet used to open on « Une fois / Récurrente », a question about the
 * schedule, and only learned whether the money came in or went out from the
 * category picked at the end. The kind is what a person knows first — they
 * are holding a receipt, or a payslip — so it leads now, and it narrows
 * everything below it: the categories, the shops, the colour of the figure.
 * Nothing is stored for it. A transaction's kind is its category's type, as
 * it always was; this is only the order the sheet asks in.
 *
 * Shared by the web and phone sheets, so the two ask the same questions in
 * the same order and can never disagree about what is still missing.
 */
export const ENTRY_KINDS = [
  "expense",
  "income",
  "savings",
  "investment",
] as const satisfies readonly CategoryType[];

/**
 * How often a recurring entry comes back, as the Add sheet offers it.
 *
 * Four answers cover what people set up from scratch. A quarter is a monthly
 * schedule on every third month from the one it starts in, which is what the
 * full form calls « Tous les trimestres »; anything rarer (every two months,
 * some months only) stays in that form, opened from Récurrents.
 */
export type EntryRhythm = "monthly" | "weekly" | "quarterly" | "yearly";

export const ENTRY_RHYTHMS: readonly EntryRhythm[] = [
  "monthly",
  "weekly",
  "quarterly",
  "yearly",
];

/** The kind the sheet opens on: the caller's, or an expense. */
export function initialEntryKind(type: CategoryType | undefined): CategoryType {
  return type ?? "expense";
}

/**
 * A kind's categories, the ones used lately first.
 *
 * Recents keep the order they were used in; the rest keep the order the
 * caller had them in, which is already the user's own.
 */
export function categoriesOfKind(
  categories: readonly Category[],
  kind: CategoryType,
  recentIds: readonly string[] = [],
): Category[] {
  const ofKind = categories.filter((category) => category.type === kind);
  const recent = recentIds
    .map((id) => ofKind.find((category) => category.id === id))
    .filter((category): category is Category => category !== undefined);
  const rest = ofKind.filter((category) => !recentIds.includes(category.id));
  return [...recent, ...rest];
}

/** The remembered shops whose category is of this kind. */
export function merchantsOfKind(
  rules: readonly MerchantRule[],
  kind: CategoryType,
): MerchantRule[] {
  return rules.filter((rule) => rule.categoryType === kind);
}

/**
 * The one thing still standing between the entry and saving it, in the order
 * the sheet asks: an amount, then a category. Null when it can be saved.
 *
 * The save button says this instead of greying out without a word.
 */
export type EntryGap = "amount" | "category" | null;

export function entryGap(entry: {
  amountComplete: boolean;
  hasCategory: boolean;
}): EntryGap {
  if (!entry.amountComplete) {
    return "amount";
  }
  if (!entry.hasCategory) {
    return "category";
  }
  return null;
}

export interface EntrySchedule {
  rhythm: EntryRhythm;
  /** 1–31, for every rhythm but weekly. */
  dayOfMonth: number;
  /** ISO weekday, 1 = Monday, for a weekly one. */
  dayOfWeek: number;
  /**
   * 1–12. The month a yearly one falls in, and the month a quarterly one
   * starts from (so « chaque trimestre » set up in November falls in
   * February, May, August and November).
   */
  month: number;
}

/**
 * The schedule as a recurring template stores it, from the four answers the
 * sheet offers. The shape `formatRecurrenceSchedule` and
 * `scheduleDatesBefore` read, so the sheet can say the schedule back and know
 * which of its days are already behind today.
 */
export function scheduleOfEntry(schedule: EntrySchedule): {
  recurrence: Recurrence;
  day_of_month: number | null;
  day_of_week: number | null;
  month_of_year: number | null;
  months: MonthSet;
} {
  switch (schedule.rhythm) {
    case "weekly":
      return {
        recurrence: "weekly",
        day_of_month: null,
        day_of_week: schedule.dayOfWeek,
        month_of_year: null,
        months: null,
      };
    case "yearly":
      return {
        recurrence: "yearly",
        day_of_month: schedule.dayOfMonth,
        day_of_week: null,
        month_of_year: schedule.month,
        months: null,
      };
    case "quarterly":
      return {
        recurrence: "monthly",
        day_of_month: schedule.dayOfMonth,
        day_of_week: null,
        month_of_year: null,
        months: monthsEvery(3, schedule.month),
      };
    case "monthly":
      return {
        recurrence: "monthly",
        day_of_month: schedule.dayOfMonth,
        day_of_week: null,
        month_of_year: null,
        months: null,
      };
  }
}

/**
 * The schedule fields of a recurring template's save payload — the names
 * `recurringTemplateSchema` reads — so the web and phone sheets send exactly
 * what the full form sends for the same schedule.
 */
export function schedulePayload(
  schedule: EntrySchedule,
): Record<string, unknown> {
  const stored = scheduleOfEntry(schedule);
  if (stored.recurrence === "weekly") {
    return { recurrence: "weekly", dayOfWeek: String(stored.day_of_week) };
  }
  if (stored.recurrence === "yearly") {
    return {
      recurrence: "yearly",
      dayOfMonth: String(stored.day_of_month),
      monthOfYear: String(stored.month_of_year),
    };
  }
  return {
    recurrence: "monthly",
    dayOfMonth: String(stored.day_of_month),
    months: stored.months,
  };
}

/**
 * Only a monthly income can be paid with an advance (« Avec un acompte »):
 * the same rule as the full form.
 */
export function offersAdvance(
  kind: CategoryType,
  rhythm: EntryRhythm,
): boolean {
  return kind === "income" && rhythm === "monthly";
}
