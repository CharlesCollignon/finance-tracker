import type { CategoryType } from "./types/database";

/**
 * « Déclaration de revenus » (`docs/plans/EVERYDAY_PLAN.md`, phase 8): the
 * boxes of the French income tax return a person's own rows can fill, each
 * with the year's amount and the rows behind it.
 *
 * What it is not, and says so: a return. Pluclair sums what was recorded;
 * the person checks each box on impots.gouv.fr and files it themselves.
 * Nothing here estimates a tax, a reduction or a credit — the ceilings that
 * decide them (children, the household, the retirement ceiling printed on
 * one's tax notice) are not the app's to know.
 *
 * The boxes, rates and ceilings are a yearly table, checked each April when
 * the forms come out. A year whose forms are not out yet is shown with the
 * latest known year's boxes, and says so.
 */

/** The boxes this page fills. */
export type TaxBoxId =
  "7UF" | "7UD" | "7DB" | "7GA" | "7GB" | "7GC" | "6NS" | "4BE" | "5NI";

/**
 * Where a box's amount comes from: the categories the person filed in it,
 * or a source the app already knows — the PER wallet's payments, a let
 * property's rents.
 */
export type TaxBoxSource =
  "categories" | "per" | "rent-bare" | "rent-furnished";

export interface TaxBoxRule {
  id: TaxBoxId;
  source: TaxBoxSource;
  /** Which way the money went for it to count. */
  type: CategoryType;
  /** The rate the form applies, as a fraction, where it says one. */
  rate: number | null;
  /** The ceiling the form applies to the amount, in euros, where it says one. */
  ceiling: number | null;
  /** Read from a source to check again: not every box was confirmed. */
  verify?: true;
}

export interface TaxYearRules {
  /** The year the income was earned. */
  incomeYear: number;
  /** The year of the forms these boxes were read from. */
  formsYear: number;
  boxes: TaxBoxRule[];
}

/**
 * The 2026 forms, for 2025 income — as read on 2026-10-09 from the press
 * guides and the BOFiP, the notices themselves being out of reach. To check
 * against the 2042, 2042-RICI and 2042-C-PRO notices of each new April.
 *
 * - 7UF: gifts to bodies of general interest, a 66 % reduction within 20 %
 *   of taxable income.
 * - 7UD: gifts to help people in difficulty, 75 % up to 1,000 € for gifts
 *   until 13 October 2025 (7UQ, up to 2,000 €, after it; the 2026 finance
 *   law raised the ceiling).
 * - 7DB: employing someone at home, a 50 % credit on 12,000 € a year, raised
 *   by 1,500 € per child or person over 65, at most 15,000 €.
 * - 7GA–7GC: childcare outside the home for a child under six, a 50 % credit
 *   on 3,500 € per child (7GE–7GG in shared custody, not filled here).
 * - 6NS: payments into one's PER, deductible within the retirement ceiling
 *   printed on the tax notice.
 * - 4BE: a bare let's gross rents under micro-foncier, up to 15,000 € a
 *   year, 30 % taken off.
 * - 5NI: a furnished let's receipts under micro-BIC, 50 % taken off up to
 *   77,700 € — the code the administration gave after the 2024 law on
 *   furnished lets replaced 5ND; to verify.
 */
const FORMS_2026: TaxYearRules = {
  incomeYear: 2025,
  formsYear: 2026,
  boxes: [
    {
      id: "7UF",
      source: "categories",
      type: "expense",
      rate: 0.66,
      ceiling: null,
    },
    {
      id: "7UD",
      source: "categories",
      type: "expense",
      rate: 0.75,
      ceiling: 1000,
    },
    {
      id: "7DB",
      source: "categories",
      type: "expense",
      rate: 0.5,
      ceiling: 12000,
    },
    {
      id: "7GA",
      source: "categories",
      type: "expense",
      rate: 0.5,
      ceiling: 3500,
    },
    {
      id: "7GB",
      source: "categories",
      type: "expense",
      rate: 0.5,
      ceiling: 3500,
    },
    {
      id: "7GC",
      source: "categories",
      type: "expense",
      rate: 0.5,
      ceiling: 3500,
    },
    { id: "6NS", source: "per", type: "investment", rate: null, ceiling: null },
    {
      id: "4BE",
      source: "rent-bare",
      type: "income",
      rate: 0.3,
      ceiling: 15000,
    },
    {
      id: "5NI",
      source: "rent-furnished",
      type: "income",
      rate: 0.5,
      ceiling: 77700,
      verify: true,
    },
  ],
};

/** Every year read so far, latest last. */
export const FRENCH_TAX_BOXES: readonly TaxYearRules[] = [FORMS_2026];

/** The boxes a person may file a category in. */
export const CATEGORY_BOXES: readonly TaxBoxId[] = FORMS_2026.boxes
  .filter((box) => box.source === "categories")
  .map((box) => box.id);

/**
 * The rules for an income year, and whether they are that year's own: a
 * year whose forms are not out yet borrows the latest known, provisionally.
 */
export function taxRulesFor(incomeYear: number): {
  rules: TaxYearRules;
  provisional: boolean;
} {
  const own = FRENCH_TAX_BOXES.find((rules) => rules.incomeYear === incomeYear);
  if (own) {
    return { rules: own, provisional: false };
  }
  const known = [...FRENCH_TAX_BOXES].sort(
    (a, b) => a.incomeYear - b.incomeYear,
  );
  const earlier = known.filter((rules) => rules.incomeYear < incomeYear).at(-1);
  return { rules: earlier ?? known.at(-1)!, provisional: true };
}

/** The income year a return filed in `today`'s year is about. */
export function incomeYearFor(today: string): number {
  return Number(today.slice(0, 4)) - 1;
}

/**
 * The weeks the return is filed in: April to June. Le point offers the page
 * then; it is reachable all year.
 */
export function inTaxSeason(today: string): boolean {
  const month = Number(today.slice(5, 7));
  return month >= 4 && month <= 6;
}

/** A row as the page sums it. */
export interface TaxRow {
  id: string;
  occurredOn: string;
  amount: number;
  note: string | null;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  /** The investment wallet a row pays into, by its category's name. */
  walletId: string | null;
  /** The let property a rent was recorded for, and how it is let. */
  rent: "bare" | "furnished" | null;
}

export interface TaxBoxFigure {
  rule: TaxBoxRule;
  /** What the year's rows add up to for this box. */
  amount: number;
  rows: TaxRow[];
  /** The categories filed in it, for the page to name and change. */
  categoryIds: string[];
}

/**
 * Each box with the year's amount: the rows of the categories filed in it,
 * or of its own source. A row counts in one box at most — a category filed
 * in a box is that box's, whatever source might also claim it.
 */
export function taxReturnBoxes(
  rules: TaxYearRules,
  rows: readonly TaxRow[],
  filed: ReadonlyMap<string, TaxBoxId>,
): TaxBoxFigure[] {
  const year = String(rules.incomeYear);
  const inYear = rows.filter((row) => row.occurredOn.startsWith(year));

  return rules.boxes.map((rule): TaxBoxFigure => {
    const categoryIds = [...filed.entries()]
      .filter(([, box]) => box === rule.id)
      .map(([categoryId]) => categoryId);
    const mine = inYear.filter((row) => {
      if (row.categoryType !== rule.type) {
        return false;
      }
      if (categoryIds.includes(row.categoryId)) {
        return true;
      }
      if (filed.has(row.categoryId)) {
        return false;
      }
      switch (rule.source) {
        case "categories":
          return false;
        case "per":
          return row.walletId === "per";
        case "rent-bare":
          return row.rent === "bare";
        case "rent-furnished":
          return row.rent === "furnished";
      }
    });
    return {
      rule,
      amount:
        Math.round(mine.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
      rows: [...mine].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
      categoryIds,
    };
  });
}
