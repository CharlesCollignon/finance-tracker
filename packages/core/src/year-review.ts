import { formatPercentLabel, formatSignedPercentOf } from "./constants";
import type { Locale } from "./i18n/locale";
import type { Translate } from "./i18n/t";
import type { CategoryType } from "./types/database";

/**
 * « Votre année » (docs/plans/EVERYDAY_PLAN.md, phase 5): the year just
 * ended, in a few cards, every one of them measured — what the year kept,
 * the months closed and the longest run of them, the category that moved
 * most, the milestones reached.
 *
 * Shown in January, for the year before; to share, it has a version with no
 * amount in it (`yearReviewCards` without a money formatter): percentages
 * and counts only.
 */

export interface YearReviewClose {
  /** YYYY-MM. */
  monthKey: string;
  /** What the month kept; null for a baseline. */
  kept: number | null;
  /** Whether it counts toward a run (`monthWasWon`). */
  won: boolean;
}

export interface YearReviewRow {
  occurredOn: string;
  amount: number;
  categoryName: string;
  categoryType: CategoryType;
}

export interface YearReview {
  year: number;
  /**
   * What the year kept: the closes' sum where there are closes, and income
   * less spending where there are none — said apart, since only the first is
   * checked against the bank.
   */
  kept: {
    amount: number;
    /** Of the year's income, as a fraction, when there was income. */
    rate: number | null;
    source: "closes" | "recorded";
  } | null;
  /** Months closed in the year, and the longest run of them won. */
  closes: { count: number; bestRun: number };
  /**
   * The twelve months, January first: closed or not, won or not, and
   * whether the month is in the longest run — what the story lights up.
   */
  months: {
    monthKey: string;
    closed: boolean;
    won: boolean;
    inBestRun: boolean;
  }[];
  /**
   * The expense category that moved most against the year before, or — with
   * no year before to compare — the one that took the largest share.
   */
  category:
    | {
        kind: "change";
        name: string;
        change: number;
        /** The year before's total, and this year's. */
        before: number;
        after: number;
      }
    | { kind: "share"; name: string; share: number; amount: number }
    | null;
  /** The milestones reached in the year, smallest first. */
  milestones: number[];
}

/** Below this, a category's year is too small for its change to mean much. */
const CATEGORY_FLOOR = 100;
/** A change smaller than this is the same year twice. */
const CATEGORY_MIN_CHANGE = 0.1;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function spendingByCategory(
  rows: readonly YearReviewRow[],
  year: number,
): Map<string, number> {
  const prefix = `${year}-`;
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.categoryType !== "expense" || !row.occurredOn.startsWith(prefix)) {
      continue;
    }
    totals.set(
      row.categoryName,
      (totals.get(row.categoryName) ?? 0) + row.amount,
    );
  }
  return totals;
}

/** A month as one number, so the month after is this one plus one. */
function monthIndex(monthKey: string): number {
  return Number(monthKey.slice(0, 4)) * 12 + Number(monthKey.slice(5, 7));
}

/** The longest run of consecutive months won, among the year's closes. */
function bestRun(closes: readonly YearReviewClose[]): number {
  const sorted = [...closes].sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const close of sorted) {
    const index = monthIndex(close.monthKey);
    run = close.won ? (previous === index - 1 ? run + 1 : 1) : 0;
    best = Math.max(best, run);
    previous = index;
  }
  return best;
}

/** The twelve months of a year, lit by its closes and its longest run. */
function monthsOf(
  year: number,
  closes: readonly YearReviewClose[],
): YearReview["months"] {
  const byKey = new Map(closes.map((close) => [close.monthKey, close]));
  const months = Array.from({ length: 12 }, (_, index) => {
    const monthKey = `${year}-${String(index + 1).padStart(2, "0")}`;
    const close = byKey.get(monthKey);
    return {
      monthKey,
      closed: close !== undefined,
      won: close?.won ?? false,
      inBestRun: false,
    };
  });
  // The longest run, the first of them when two are as long.
  const best = bestRun(closes);
  if (best > 0) {
    let run = 0;
    for (let index = 0; index < months.length; index += 1) {
      run = months[index]!.won ? run + 1 : 0;
      if (run === best) {
        for (let back = index - best + 1; back <= index; back += 1) {
          months[back]!.inBestRun = true;
        }
        break;
      }
    }
  }
  return months;
}

/**
 * The year's review, or null when it has nothing to say: no close, no row.
 *
 * `rows` should hold the year and the one before, for the category's change.
 */
export function buildYearReview({
  year,
  closes,
  rows,
  milestones,
}: {
  year: number;
  /** Every close; those of the year are picked out. */
  closes: readonly YearReviewClose[];
  rows: readonly YearReviewRow[];
  /** When each milestone was reached (`milestone_history`). */
  milestones: readonly { amount: number; on: string }[];
}): YearReview | null {
  const prefix = `${year}-`;
  const yearCloses = closes.filter((close) =>
    close.monthKey.startsWith(prefix),
  );
  const yearRows = rows.filter((row) => row.occurredOn.startsWith(prefix));
  if (yearCloses.length === 0 && yearRows.length === 0) {
    return null;
  }

  const income = yearRows
    .filter((row) => row.categoryType === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const spending = yearRows
    .filter((row) => row.categoryType === "expense")
    .reduce((sum, row) => sum + row.amount, 0);
  const closedKept = yearCloses.filter((close) => close.kept !== null);
  const keptAmount =
    closedKept.length > 0
      ? closedKept.reduce((sum, close) => sum + (close.kept ?? 0), 0)
      : income > 0
        ? income - spending
        : null;
  const kept =
    keptAmount === null
      ? null
      : {
          amount: roundMoney(keptAmount),
          rate:
            income > 0 ? Math.round((keptAmount / income) * 1000) / 1000 : null,
          source:
            closedKept.length > 0 ? ("closes" as const) : ("recorded" as const),
        };

  const thisYear = spendingByCategory(rows, year);
  const lastYear = spendingByCategory(rows, year - 1);
  let category: YearReview["category"] = null;
  if (lastYear.size > 0) {
    let best: {
      name: string;
      change: number;
      before: number;
      after: number;
    } | null = null;
    for (const [name, total] of thisYear) {
      const before = lastYear.get(name) ?? 0;
      if (total < CATEGORY_FLOOR || before < CATEGORY_FLOOR) {
        continue;
      }
      const change = (total - before) / before;
      if (
        Math.abs(change) >= CATEGORY_MIN_CHANGE &&
        (best === null || Math.abs(change) > Math.abs(best.change))
      ) {
        best = {
          name,
          change: Math.round(change * 100) / 100,
          before: roundMoney(before),
          after: roundMoney(total),
        };
      }
    }
    category = best ? { kind: "change", ...best } : null;
  }
  if (category === null && spending > 0) {
    const [name, total] = [...thisYear].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (name !== undefined && total !== undefined) {
      category = {
        kind: "share",
        name,
        share: Math.round((total / spending) * 100) / 100,
        amount: roundMoney(total),
      };
    }
  }

  return {
    year,
    kept,
    closes: { count: yearCloses.length, bestRun: bestRun(yearCloses) },
    months: monthsOf(year, yearCloses),
    category,
    milestones: milestones
      .filter((milestone) => milestone.on.startsWith(prefix))
      .map((milestone) => milestone.amount)
      .sort((a, b) => a - b),
  };
}

/** The year « Votre année » is about, and whether it is shown today. */
export function reviewedYear(today: string): number | null {
  // January, for the year before: the review waits for the year to be over,
  // and stops being news once the new one is under way.
  return today.slice(5, 7) === "01" ? Number(today.slice(0, 4)) - 1 : null;
}

/** What the review is put away under, in `dismissed_prompts`. */
export function yearReviewPrompt(year: number): string {
  return `year:${year}`;
}

/** One card of the review: its big figure, what it is, and a line under. */
export interface YearReviewCard {
  id: "kept" | "closes" | "category" | "milestones";
  figure: string;
  caption: string;
  note: string | null;
}

/**
 * The review as cards, the same on both apps. Without `formatMoney` they
 * are the cards to share: no amount anywhere, the kept card a rate.
 */
export function yearReviewCards(
  review: YearReview,
  {
    t,
    locale,
    formatMoney,
  }: {
    t: Translate;
    locale: Locale;
    /** Null for the version to share, which shows no amount. */
    formatMoney: ((amount: number) => string) | null;
  },
): YearReviewCard[] {
  const sharing = formatMoney === null;
  const cards: YearReviewCard[] = [];

  if (review.kept) {
    const rate =
      review.kept.rate === null
        ? null
        : formatPercentLabel(review.kept.rate * 100, locale);
    if (!sharing) {
      cards.push({
        id: "kept",
        figure: formatMoney(review.kept.amount),
        caption: t("yearReview.keptCaption", { year: review.year }),
        note: [
          rate ? t("yearReview.keptRate", { rate }) : null,
          t(
            review.kept.source === "closes"
              ? "yearReview.keptFromCloses"
              : "yearReview.keptFromRecorded",
          ),
        ]
          .filter(Boolean)
          .join(" · "),
      });
    } else if (rate) {
      cards.push({
        id: "kept",
        figure: rate,
        caption: t("yearReview.imageKeptCaption"),
        note: null,
      });
    }
  }

  if (review.closes.count > 0) {
    // To share, the longest run where there is one; the months closed else.
    const run = sharing && review.closes.bestRun > 0;
    cards.push({
      id: "closes",
      figure: String(run ? review.closes.bestRun : review.closes.count),
      caption: run
        ? t("yearReview.imageRunCaption", { count: review.closes.bestRun })
        : t("yearReview.closesCaption", { count: review.closes.count }),
      note:
        !sharing && review.closes.bestRun > 0
          ? t("yearReview.bestRun", { count: review.closes.bestRun })
          : null,
    });
  }

  if (review.category) {
    const { category } = review;
    cards.push(
      category.kind === "change"
        ? {
            id: "category",
            figure: formatSignedPercentOf(category.change, locale, 0),
            caption: t(
              sharing
                ? "yearReview.imageCategoryChangeCaption"
                : "yearReview.categoryChangeCaption",
              { name: category.name, previous: review.year - 1 },
            ),
            note: null,
          }
        : {
            id: "category",
            figure: formatPercentLabel(
              Math.round(category.share * 100),
              locale,
            ),
            caption: t(
              sharing
                ? "yearReview.imageCategoryShareCaption"
                : "yearReview.categoryShareCaption",
              { name: category.name },
            ),
            note: null,
          },
    );
  }

  if (review.milestones.length > 0) {
    cards.push({
      id: "milestones",
      figure: String(review.milestones.length),
      caption: t("yearReview.milestonesCaption", {
        count: review.milestones.length,
      }),
      note: sharing
        ? null
        : review.milestones.map((amount) => formatMoney(amount)).join(" · "),
    });
  }

  return cards;
}
