import {
  buildCategoryFacts,
  MIN_MONTHS_FOR_CATEGORY_READ,
  type CategoryFacts,
} from "./category-facts";
import {
  buildCategoryFindings,
  categoryNormal,
  NORMAL_WINDOW,
  type CategoryFinding,
  type FindingKind,
} from "./category-findings";
import {
  buildCategoryHistory,
  categoryBucketing,
  type CategoryHistory,
  type CategoryMonthPoint,
} from "./category-history";
import type { CategoryRead } from "./category-read";
import {
  applySelection,
  findingsDigest,
  selectionRemarks,
  type CategorySelection,
} from "./category-selection";
import { formatMonthLabel } from "./constants";
import type { Locale } from "./i18n/locale";
import type {
  CategoryBreakdown,
  CategoryType,
  TransactionWithCategory,
} from "./types/database";

/**
 * The by-category screen, assembled — for both apps.
 *
 * The web page built all of this inline, over rows it had fetched; the phone
 * needs the same answer from the same rows, so the arithmetic lives here and
 * each app only fetches. Nothing here queries: `@finance/data/category-screen`
 * gathers the rows and stored reads and hands them in.
 */

/**
 * How far back the screen reads.
 *
 * Seasonality cannot be measured inside a twelve-month window — the same
 * calendar month has to appear at least twice — so the read widens and the
 * screen does not.
 *
 * One constant for every reader: the write path behind the re-rank button
 * rebuilds these same findings and fingerprints them, and the screen
 * fingerprints its own. Two windows that disagreed by a month would produce
 * two digests that never match, and the band would report every stored order
 * as stale forever — a failure that looks like nothing at all going wrong.
 */
export const CATEGORY_MONTHS_READ = 36;

/** How far back a tile draws: twenty-four bars in a phone column are a texture. */
export const CATEGORY_MONTHS_DRAWN = 12;

/** One category's run, as a tile and its panel draw it. */
export interface CategoryCard {
  history: CategoryHistory;
  normal: number;
  drawn: CategoryMonthPoint[];
  findings: CategoryFinding[];
}

/** One of the entries behind the month a panel explains. */
export interface PanelTransaction {
  id: string;
  occurredOn: string;
  note: string | null;
  amount: number;
}

/**
 * The month-independent half of a category read's pack: everything that
 * does not need a database, so it can be built once from data the screen
 * already holds — and again, on demand, for the one category a write is
 * about.
 */
export interface CurrentCategoryFactsInput {
  categoryId: string;
  categoryName: string;
  type: CategoryType;
  /** Undefined when nothing at all has been recorded in the window. */
  history: CategoryHistory | undefined;
  /** This category's own findings, already picked out of the screen's list. */
  findings: readonly CategoryFinding[];
  /** The month on screen's total expenses, for `share-of-month`. */
  monthExpenses: number;
  monthLabel: string;
  locale: Locale;
}

function signedSeverity(
  findings: readonly CategoryFinding[],
  kind: FindingKind,
): number | null {
  const finding = findings.find((row) => row.kind === kind);
  if (!finding) {
    return null;
  }
  return finding.direction === "up" ? finding.severity : -finding.severity;
}

/** Non-empty months inside the window `normal` is taken over. */
function monthsActiveCount(history: CategoryHistory | undefined): number {
  const points = history?.points ?? [];
  return points.slice(-NORMAL_WINDOW).filter((point) => !point.empty).length;
}

/**
 * Whether a category has too little history to be worth a read — what
 * every card needs, whether or not it has a stored read to render. Apart
 * from `currentCategoryFacts` because it does not need `monthExpenses`,
 * which only a rendered read ever shows.
 */
export function categoryReadIsThin(
  history: CategoryHistory | undefined,
): boolean {
  return monthsActiveCount(history) < MIN_MONTHS_FOR_CATEGORY_READ;
}

/**
 * Build the pack from figures already in hand — no query of its own. One
 * place turns those figures into a `CategoryFacts`, so a change to what
 * "normal" or "share of month" means cannot drift between the screen and the
 * write path.
 */
export function currentCategoryFacts(
  input: CurrentCategoryFactsInput,
): CategoryFacts {
  const points = input.history?.points ?? [];
  const { normal } = categoryNormal(points);
  const last = points[points.length - 1];
  const latest = last && !last.empty ? last.total : null;

  const shareOfMonth =
    input.type === "expense" && latest !== null && input.monthExpenses > 0
      ? latest / input.monthExpenses
      : null;

  return buildCategoryFacts({
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    type: input.type,
    normal,
    latest,
    monthsActive: monthsActiveCount(input.history),
    monthLabel: input.monthLabel,
    drift: signedSeverity(input.findings, "drift"),
    oddMonth: signedSeverity(input.findings, "odd-month"),
    shareOfMonth,
    locale: input.locale,
  });
}

/** A stored category read, as much of it as the screen draws. */
export interface StoredReadInput {
  read: CategoryRead | null;
  model: string | null;
  /** The language the prose was written in. */
  locale: Locale;
}

/** The band's stored order, as much of it as the screen applies. */
export interface StoredSelectionInput {
  selection: CategorySelection;
  /** The findings it was chosen from. Null means it cannot be trusted at all. */
  digest: string | null;
  /** The language the remarks are in. */
  locale: Locale;
}

export interface CategoryScreenInput {
  /** Every row of the last `CATEGORY_MONTHS_READ` months. */
  rows: readonly TransactionWithCategory[];
  /** The month in progress. */
  year: number;
  month: number;
  locale: Locale;
  storedReads: ReadonlyMap<string, StoredReadInput>;
  storedSelection: StoredSelectionInput | null;
  /**
   * This month's expenses, for a read's `share-of-month`. Null when no read
   * is stored, which is the only time it is not needed.
   */
  monthExpenses: number | null;
}

export interface CategoryScreen {
  cards: CategoryCard[];
  /** Every finding, in the app's own order — what a re-rank would rank. */
  allFindings: CategoryFinding[];
  /** The band's findings, in the order it reads them: the app's or a model's. */
  findings: CategoryFinding[];
  /** A model's remark per finding id, where one survived and applies. */
  remarks: Record<string, string>;
  /** Whose order the band is showing, and whether a stored one was refused. */
  rerankState: "none" | "applied" | "stale";
  /** This month's expense composition, for the strip. */
  breakdown: CategoryBreakdown[];
  breakdownTotal: number;
  /** The entries behind the month each category's panel explains. */
  behind: Record<string, PanelTransaction[]>;
  /** That month, as `YYYY-MM`. */
  behindMonth: Record<string, string>;
  /** That month, as a label. */
  behindMonthLabel: Record<string, string>;
  /** A category read, per category id. Null where nothing has been written. */
  reads: Record<string, CategoryRead | null>;
  /** The current figures behind each read, labelled in its own language. */
  readFacts: Record<string, CategoryFacts | null>;
  readLocale: Record<string, Locale>;
  /** Too little recorded to be worth a read. */
  readThin: Record<string, boolean>;
  /** Which model wrote each stored read — not necessarily today's. */
  readModels: Record<string, string | null>;
}

/** Whether a read is stored for any category — and so `monthExpenses` is needed. */
export function hasStoredRead(
  storedReads: ReadonlyMap<string, StoredReadInput>,
): boolean {
  return [...storedReads.values()].some((row) => row.read !== null);
}

export function buildCategoryScreen(
  input: CategoryScreenInput,
): CategoryScreen {
  const { rows, year, month, locale } = input;

  const histories = buildCategoryHistory([...rows], year, month, {
    months: CATEGORY_MONTHS_READ,
    locale,
  });
  const allFindings = buildCategoryFindings(histories);

  // Biggest first — over the months a tile actually draws, not over the
  // whole window read, or a category heavy two years ago would sit above
  // one heavy now beside a tile showing nothing but the quiet twelve.
  const drawnTotal = (points: CategoryMonthPoint[]) =>
    points.reduce((sum, point) => sum + point.total, 0);
  const cards = histories
    .map((history) => ({
      history,
      normal: categoryNormal(history.points).normal,
      drawn: history.points.slice(-CATEGORY_MONTHS_DRAWN),
      findings: allFindings.filter((f) => f.categoryId === history.categoryId),
    }))
    .sort((left, right) => drawnTotal(right.drawn) - drawnTotal(left.drawn));

  // The band's order, which is the app's until somebody asks for another.
  // A stored order whose findings have since moved is refused rather than
  // applied, and the band says so. Only the band is re-ordered: which month
  // a panel opens on is not a question anyone asked a model.
  const stored = input.storedSelection;
  const applied =
    stored && stored.digest === findingsDigest(allFindings) ? stored : null;
  const stale = stored !== null && applied === null;
  const findings = applied
    ? applySelection(allFindings, applied.selection)
    : allFindings;
  // A remark is the model's own prose, shown only to a reader in its
  // language; the order itself has none and applies either way.
  const remarks =
    applied && applied.locale === locale
      ? selectionRemarks(applied.selection)
      : {};
  const rerankState = stale ? "stale" : applied ? "applied" : "none";

  const latestKey = `${year}-${String(month).padStart(2, "0")}`;
  const breakdown = histories
    .filter((history) => history.type === "expense")
    .map((history) => ({
      categoryId: history.categoryId,
      name: history.name,
      type: "expense" as const,
      icon: null,
      total:
        history.points.find((point) => point.monthKey === latestKey)?.total ??
        0,
    }))
    .filter((row) => row.total > 0);
  const breakdownTotal = breakdown.reduce((sum, row) => sum + row.total, 0);

  // The same bucketing the history used, so a period-shifted category's
  // "behind this month" list comes from the buckets its chart is drawn from.
  const bucketing = categoryBucketing([...rows]);
  const behind: Record<string, PanelTransaction[]> = {};
  const behindMonth: Record<string, string> = {};
  const behindMonthLabel: Record<string, string> = {};
  for (const card of cards) {
    const target =
      card.findings[0]?.months[card.findings[0].months.length - 1] ??
      card.drawn[card.drawn.length - 1]?.monthKey;
    if (!target) {
      continue;
    }
    const grouping = bucketing.get(card.history.categoryId);
    behind[card.history.categoryId] = rows
      .filter(
        (row) =>
          row.category_id === card.history.categoryId &&
          (grouping
            ? grouping.keyOf(row.occurred_on) === target
            : row.occurred_on.startsWith(target)),
      )
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
      .map((entry) => ({
        id: entry.id,
        occurredOn: entry.occurred_on,
        note: entry.note,
        amount: Number(entry.amount),
      }));
    const [y, m] = target.split("-").map(Number);
    behindMonth[card.history.categoryId] = target;
    behindMonthLabel[card.history.categoryId] = formatMonthLabel(y, m, locale);
  }

  const readMonthLabel = formatMonthLabel(year, month, locale);
  const reads: Record<string, CategoryRead | null> = {};
  const readFacts: Record<string, CategoryFacts | null> = {};
  const readLocale: Record<string, Locale> = {};
  const readThin: Record<string, boolean> = {};
  const readModels: Record<string, string | null> = {};
  for (const card of cards) {
    const categoryId = card.history.categoryId;
    const storedRead = input.storedReads.get(categoryId) ?? null;
    const languageOfRead = storedRead?.locale ?? locale;

    reads[categoryId] = storedRead?.read ?? null;
    readModels[categoryId] = storedRead?.read ? storedRead.model : null;
    readLocale[categoryId] = languageOfRead;
    readThin[categoryId] = categoryReadIsThin(card.history);
    readFacts[categoryId] =
      storedRead?.read && input.monthExpenses !== null
        ? currentCategoryFacts({
            categoryId,
            categoryName: card.history.name,
            type: card.history.type,
            history: card.history,
            findings: card.findings,
            monthExpenses: input.monthExpenses,
            monthLabel: readMonthLabel,
            locale: languageOfRead,
          })
        : null;
  }

  return {
    cards,
    allFindings,
    findings,
    remarks,
    rerankState,
    breakdown,
    breakdownTotal,
    behind,
    behindMonth,
    behindMonthLabel,
    reads,
    readFacts,
    readLocale,
    readThin,
    readModels,
  };
}
