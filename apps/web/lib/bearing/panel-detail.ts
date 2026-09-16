import type { FactFamily } from "@finance/core/bearing-facts";
import type { PanelBlock } from "@finance/core/bearing-panels";
import {
  formatMonthLabel,
  getCurrentMonth,
  savingsRatePercent,
  todayIsoLocal,
  type BudgetViewMode,
} from "@finance/core/constants";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildMonthPulse, type MonthPulse } from "@finance/core/month-pulse";
import { previousMonthKey } from "@finance/core/month-close";
import type { RecordedCashFlows } from "@finance/core/month-close";
import { buildStillToCome } from "@finance/core/still-to-come";
import {
  buildForwardProjection,
  buildRunway,
  type ForwardProjection,
  type Runway,
} from "@finance/core/projection";
import {
  holdingWeights,
  type HoldingWeight,
} from "@finance/core/portfolio-weights";
import { writesRemaining } from "@finance/core/month-read-budget";
import type { ReadFreshness } from "@finance/core/month-read-budget";
import type { MonthFacts } from "@finance/core/month-facts";
import type { MonthRead as MonthReadValue } from "@finance/core/month-read";
import type { Locale } from "@finance/core/i18n/locale";
import { bankFeedConfigured } from "@/lib/bank/client";
import { monthReadConfigured } from "@/lib/month-read/client";
import { gatherMonthFacts } from "@/lib/month-read/facts";
import { readMonthReadState } from "@/lib/month-read/store";
import { getCategories } from "@/lib/queries/categories";
import {
  getMonthComparison,
  getMonthlySummary,
  getMonthlyTrend,
  getRecurringSkipKeys,
  getRecurringTemplates,
  getSavingsReserve,
  getTransactions,
} from "@/lib/queries/finance";
import { getBudgets } from "@/lib/queries/phase4";
import { getFulfilledKeys } from "@/lib/queries/fulfilment";
import {
  countFeedItems,
  getDecidedFeedItems,
  getPendingFeedItems,
  getRecentBankMovements,
} from "@/lib/queries/bank";
import { getBankAccounts, readCashBalance } from "@/lib/queries/bank-balance";
import {
  getMonthCloseOverview,
  getRecordedCashFlows,
} from "@/lib/queries/month-close";
import { getMonthRead } from "@/lib/queries/month-read";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";

/**
 * Which figures a panel is asking about.
 *
 * Only the `month` family reads all of it. `now` deliberately ignores the
 * month entirely — "now" is today, and a balance is only ever true now — and
 * `ahead` reads the horizon rather than the month. One object rather than
 * three so the server function has a single parameter to validate and the
 * phone's route has a single query string to build.
 */
export interface PanelScope {
  year: number;
  month: number;
  /** Which arithmetic the month's figures use. Defaults to as-of-today. */
  view?: BudgetViewMode;
  /** How many months ahead the projection runs. Defaults to a year. */
  horizon?: number;
}

/** A year, which is what the Plan surface has always projected. */
const DEFAULT_HORIZON = 12;

/**
 * The figures the hero card states and the arithmetic behind them.
 *
 * Bundled rather than spread across the `now` branch because they are one
 * card's props and splitting them would invite a caller to pass four of the
 * six — which is how a card ends up stating a balance beside a month it does
 * not belong to.
 */
export interface HeroFigures {
  pulse: MonthPulse;
  monthLabel: string;
  income: number;
  expenses: number;
  remaining: number;
  budgetView: BudgetViewMode;
  /** How far through the month today is, 0–1. Null for a month not running. */
  elapsed: number | null;
  savingsRate: number | null;
  /** Named accounts whose balance could not be read, so the gap is visible. */
  unreadable: string[];
  /** Net per month, oldest first, for the mark beside the figure. */
  trend: number[];
  noBalanceReason: "no-bank" | "past-month" | null;
}

/** The review queue, and the vocabulary a decision on it needs. */
export interface InboxDetail {
  items: Inbox;
  decided: Decided;
  categories: Categories;
  /** True until the whole statement has been pulled once. */
  showBackfill: boolean;
}

/** The stored month read, and everything the card needs to render it. */
export interface MonthReadDetail {
  read: MonthReadValue | null;
  freshness: ReadFreshness | null;
  facts: MonthFacts;
  readFacts: MonthFacts;
  readLocale: Locale;
  writesLeft: number;
  configured: boolean;
}

type Movements = Awaited<ReturnType<typeof getRecentBankMovements>>;
type Accounts = Awaited<ReturnType<typeof getBankAccounts>>;
type Inbox = Awaited<ReturnType<typeof getPendingFeedItems>>;
type Decided = Awaited<ReturnType<typeof getDecidedFeedItems>>;
type Categories = Awaited<ReturnType<typeof getCategories>>;
type Summary = Awaited<ReturnType<typeof getMonthlySummary>>;
type Comparison = Awaited<ReturnType<typeof getMonthComparison>>;
type Trend = Awaited<ReturnType<typeof getMonthlyTrend>>;
type Closes = Awaited<ReturnType<typeof getMonthCloseOverview>>;
type Portfolio = Awaited<ReturnType<typeof getWalletPortfolio>>;
type Upcoming = ReturnType<typeof buildStillToCome>;
type Budgets = ReturnType<typeof buildBudgetProgress>;

/**
 * What sits under a figure, once somebody asks to see it.
 *
 * Keyed on family so a renderer cannot read a field its branch never
 * fetched — the alternative, one optional field per block, makes every
 * consumer prove at runtime what the type already knows.
 *
 * Every row-shaped member is spelled `Awaited<ReturnType<typeof query>>`
 * rather than restated. These are Supabase shapes with a dozen columns each
 * and a hand-written copy would drift the first time a column was added, in
 * the direction that compiles.
 */
export type PanelDetail =
  | {
      family: "now";
      hero: HeroFigures;
      comparison: Comparison;
      movements: Movements;
      accounts: Accounts;
      /** Null unless the panel's blocks asked for it — four reads it saves. */
      inbox: InboxDetail | null;
    }
  | {
      family: "month";
      /** The month these figures are for — the scope, as it was resolved. */
      year: number;
      month: number;
      monthLabel: string;
      summary: Summary;
      comparison: Comparison;
      upcoming: Upcoming;
      budgets: Budgets;
      pulse: MonthPulse;
      closes: Closes;
      trend: Trend;
      /** Null unless the panel's blocks asked for it — it is not cheap. */
      read: MonthReadDetail | null;
    }
  | { family: "run"; closes: Closes; pulse: MonthPulse; trend: Trend }
  | {
      family: "ahead";
      projection: ForwardProjection;
      runway: Runway;
      trend: Trend;
    }
  | { family: "wallet"; portfolio: Portfolio; weights: HoldingWeight[] };

/**
 * What sits under a figure, fetched only when somebody asks to see it.
 *
 * One branch per family rather than one per tile: two tiles in the same
 * family want the same underlying rows even when `bearing-panels.ts` shows
 * them different blocks, so fetching per tile would ask the database the same
 * question twice for `free` and `savings-rate`.
 *
 * `blocks` is the exception to that, and it is narrow on purpose: exactly two
 * things are fetched per panel rather than per family, and both are ones a
 * single tile in their family draws. The month read is a dozen reads and two
 * fact packs on the wire; the review queue is four more reads and the whole
 * category list. Charging the other eight month tiles and the other four
 * `now` tiles for them would be paying for a block nobody asked to see. The
 * list is a hint about work, never about access: every branch here reads only
 * this user's own rows, so a caller that lies about its blocks gets nothing
 * it was not already entitled to.
 *
 * Nothing here decides anything. Every derived figure comes out of an engine
 * in `packages/core` that another surface already renders from — which is the
 * property that makes a panel checkable against the page its footer links to.
 */
export async function gatherPanelDetail(
  userId: string,
  family: FactFamily,
  scope: PanelScope,
  blocks: readonly PanelBlock[],
  locale: Locale,
): Promise<PanelDetail> {
  switch (family) {
    case "now":
      return gatherNow(userId, blocks, locale);
    case "month":
      return gatherMonth(userId, scope, blocks, locale);
    case "run":
      return gatherRun(userId, scope);
    case "ahead":
      return gatherAhead(userId, scope, locale);
    case "wallet":
      return gatherWallet(userId);
  }
}

/* ------------------------------------------------------------------ now */

async function gatherNow(
  userId: string,
  blocks: readonly PanelBlock[],
  locale: Locale,
): Promise<PanelDetail> {
  // Always the month in progress, whatever the panel was scoped to. The
  // `now` family has no month chrome precisely because its figures are
  // today's: presenting a live balance beside March's totals would invite
  // the reader to do arithmetic across two different moments.
  const { year, month } = getCurrentMonth();

  const [figures, movements, accounts, inbox] = await Promise.all([
    monthFigures(userId, year, month, "current", locale),
    getRecentBankMovements(userId),
    getBankAccounts(userId),
    // Four reads, and only one of this family's five tiles draws them. The
    // review queue is `inbox-pending`'s panel and nobody else's.
    blocks.includes("review-inbox") ? gatherInbox(userId, locale) : null,
  ]);

  return {
    family: "now",
    hero: figures.hero,
    comparison: figures.comparison,
    movements,
    accounts,
    inbox,
  };
}

async function gatherInbox(
  userId: string,
  locale: Locale,
): Promise<InboxDetail> {
  const [items, decided, categories, feedSize] = await Promise.all([
    getPendingFeedItems(userId, locale),
    getDecidedFeedItems(userId),
    getCategories(userId),
    countFeedItems(userId),
  ]);

  return {
    items,
    decided,
    categories,
    // A statement worth of rows means the backfill has been done — the same
    // threshold the Ledger's inbox uses, so the two cannot disagree about
    // whether the history is complete.
    showBackfill: feedSize < 400,
  };
}

/* ---------------------------------------------------------------- month */

async function gatherMonth(
  userId: string,
  scope: PanelScope,
  blocks: readonly PanelBlock[],
  locale: Locale,
): Promise<PanelDetail> {
  const { year, month } = scope;
  const view = scope.view ?? "current";

  // The budget rings are this family's alone — `now` and `run` have no
  // `budgets` field to put them in — so they are fetched here rather than
  // inside the shared `monthFigures`, which used to build them for all three.
  const [figures, budgetRows, categories, read] = await Promise.all([
    monthFigures(userId, year, month, view, locale),
    getBudgets(userId),
    getCategories(userId),
    blocks.includes("month-read")
      ? gatherRead(userId, year, month, locale)
      : null,
  ]);

  return {
    family: "month",
    year,
    month,
    monthLabel: formatMonthLabel(year, month, locale),
    summary: figures.summary,
    comparison: figures.comparison,
    upcoming: figures.upcoming,
    budgets: buildBudgetProgress(
      budgetRows,
      figures.summary.expenseBreakdown,
      figures.summary.expenses,
      new Map(categories.map((category) => [category.id, category.name])),
      locale,
    ),
    pulse: figures.pulse,
    closes: figures.closes,
    trend: figures.trend,
    read,
  };
}

/**
 * The stored read, and the figures it renders against.
 *
 * Nothing here calls a model: the card renders from the row somebody already
 * paid for, and only the button on it spends. Two packs rather than one
 * whenever the read is in a language the reader is not in — the prose refers
 * to labels, so the labels have to be the ones it was written against.
 */
async function gatherRead(
  userId: string,
  year: number,
  month: number,
  locale: Locale,
): Promise<MonthReadDetail> {
  const facts = await gatherMonthFacts(userId, year, month);

  const [view, { stored }] = await Promise.all([
    getMonthRead(userId, year, month, facts),
    readMonthReadState(userId, year, month),
  ]);

  const readFacts =
    view && view.locale !== locale
      ? await gatherMonthFacts(userId, year, month, undefined, view.locale)
      : facts;

  return {
    read: view?.read ?? null,
    freshness: view?.freshness ?? null,
    facts,
    readFacts,
    readLocale: view?.locale ?? locale,
    writesLeft: writesRemaining(stored?.tally ?? null),
    configured: monthReadConfigured(),
  };
}

/* ------------------------------------------------------------------ run */

async function gatherRun(
  userId: string,
  scope: PanelScope,
): Promise<PanelDetail> {
  // The run is measured in closed months, so the shelf and the streak are the
  // whole history rather than the scoped month's slice of it. The pulse is
  // still the scoped month's, because that is what the score plays against.
  // `monthFigures` already fetches the trend, so asking for it again here was
  // the same query twice on the same path.
  const figures = await monthFigures(userId, scope.year, scope.month, "current");

  return {
    family: "run",
    closes: figures.closes,
    pulse: figures.pulse,
    trend: figures.trend,
  };
}

/* ---------------------------------------------------------------- ahead */

async function gatherAhead(
  userId: string,
  scope: PanelScope,
  locale: Locale,
): Promise<PanelDetail> {
  const today = todayIsoLocal();
  // The window opens on the month in progress whatever the panel was scoped
  // to: a projection that started from a month already over would be adding
  // the future to a past that has already happened.
  const { year, month } = getCurrentMonth();

  const [templates, closes, cash, reserve, trend] = await Promise.all([
    getRecurringTemplates(userId),
    getMonthCloseOverview(userId, today),
    readCashBalance(userId, today),
    getSavingsReserve(userId),
    getMonthlyTrend(userId),
  ]);

  return {
    family: "ahead",
    projection: buildForwardProjection({
      templates,
      year,
      month,
      today,
      months: scope.horizon ?? DEFAULT_HORIZON,
      // Never a partial sum: a reading missing an account is short by
      // whatever that account holds, so it is not a balance and cannot open
      // one.
      onHand: cash?.ok ? cash.total : null,
      closes: closes.summary,
      locale,
    }),
    runway: buildRunway(reserve, templates, year, month),
    trend,
  };
}

/* --------------------------------------------------------------- wallet */

async function gatherWallet(userId: string): Promise<PanelDetail> {
  // No history: the panel draws a split and a weighting, neither of which
  // reads a price series, so the expensive half of the portfolio read would
  // buy nothing.
  const portfolio = await getWalletPortfolio(userId, { includeHistory: false });

  return {
    family: "wallet",
    portfolio,
    weights: holdingWeights(
      portfolio.columns.flatMap((column) =>
        column.items.map((item) => ({
          id: item.id,
          label: item.name,
          value: item.marketValue,
        })),
      ),
    ),
  };
}

/* ---------------------------------------------------------------- month
 *
 * One month's figures, assembled the way the Month page assembles them.
 *
 * Shared by `now`, `month` and `run` because all three want some of it and
 * the reads underneath are request-cached: asking for the templates here and
 * again inside the summary costs one query, not two. Keeping three copies of
 * this arithmetic in step by hand is the failure it exists to prevent — a
 * pulse built from a different opening balance than the score it feeds is a
 * figure that looks authoritative and is nonsense.
 *
 * Only what all three share, though. The budget rings used to be built here
 * as well, which charged `now` and `run` two queries and a build for a field
 * neither of their `PanelDetail` variants even has; `gatherMonth` asks for
 * them itself now.
 */
async function monthFigures(
  userId: string,
  year: number,
  month: number,
  view: BudgetViewMode,
  locale?: Locale,
) {
  const today = todayIsoLocal();
  const current = getCurrentMonth();
  const isCurrentMonth = year === current.year && month === current.month;

  const [
    summary,
    comparison,
    closes,
    templates,
    transactions,
    skippedKeys,
    fulfilledKeys,
    trend,
    // What the accounts hold now, and what the month has actually moved.
    // Only for the month in progress: a past month's balance is a figure
    // from a moment that has gone.
    cash,
    flows,
  ] = await Promise.all([
    getMonthlySummary(userId, year, month, view),
    getMonthComparison(userId, year, month),
    getMonthCloseOverview(userId, today),
    getRecurringTemplates(userId),
    getTransactions(userId, year, month),
    getRecurringSkipKeys(userId, year, month),
    getFulfilledKeys(userId),
    getMonthlyTrend(userId),
    isCurrentMonth ? readCashBalance(userId, today) : null,
    isCurrentMonth ? getRecordedCashFlows(userId, year, month) : null,
  ]);

  const upcoming = buildStillToCome(
    transactions,
    templates,
    year,
    month,
    today,
    skippedKeys,
    // Without this, every recurring charge the bank delivers is forecast on
    // top of the movement that already paid it.
    fulfilledKeys,
  );

  const noFlows: RecordedCashFlows = {
    income: 0,
    expenses: 0,
    savings: 0,
    transfers: 0,
  };

  const pulse = buildMonthPulse({
    // A reading that failed comes back with `ok: false`, and its total is
    // short by whatever the unreadable accounts hold — so it is not a balance
    // and must not be presented as one.
    onHand: cash?.ok ? cash.total : null,
    committed: upcoming.leaving,
    arriving: upcoming.arriving,
    flows: flows ?? noFlows,
    openingBalance: openingBalanceFor(closes, year, month),
    cap: closes.settings.unrecordedCap,
  });

  const hero: HeroFigures = {
    pulse,
    // The reader's language, not the default one. This label is stitched into
    // a sentence — `t("month.leftIn", { month })` — so an English month name
    // inside otherwise French prose is the whole of the defect.
    monthLabel: formatMonthLabel(year, month, locale),
    income: summary.income,
    expenses: summary.expenses,
    remaining: summary.remaining,
    budgetView: view,
    // Only a month in progress has an "of it gone" to report.
    elapsed: isCurrentMonth
      ? Number(today.slice(8, 10)) / new Date(year, month, 0).getDate()
      : null,
    savingsRate: savingsRatePercent(
      summary.savings,
      summary.investments,
      summary.investmentDeployments,
      summary.income,
    ),
    unreadable: (cash?.missing ?? []).map((entry) => entry.label),
    trend: trend.map((point) => point.net),
    // "No bank" and "this month is over" are different facts, and a screen
    // that gives the first answer to both tells someone with a bank connected
    // to connect a bank.
    noBalanceReason: isCurrentMonth
      ? bankFeedConfigured()
        ? null
        : "no-bank"
      : "past-month",
  };

  return { summary, comparison, closes, upcoming, pulse, trend, hero };
}

/**
 * The balance this month's unrecorded spending is measured from.
 *
 * Only the close of the month immediately before counts. A user who has
 * fallen behind has a newest close two or three months back, and measuring
 * this month's recorded flows against that balance would compare a balance
 * against transactions from a different window — producing a figure that
 * looks authoritative and is nonsense. Null instead, which reads as "not
 * known yet" everywhere downstream.
 */
function openingBalanceFor(
  closes: Closes,
  year: number,
  month: number,
): number | null {
  const latest = closes.history[0];
  if (!latest) {
    return null;
  }
  const wanted = previousMonthKey(`${year}-${String(month).padStart(2, "0")}`);
  return latest.monthKey === wanted ? latest.closingBalance : null;
}
