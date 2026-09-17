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
import {
  buildMonthComparison,
  type MonthComparison,
} from "@finance/core/month-comparison";
import { buildMonthPulse, type MonthPulse } from "@finance/core/month-pulse";
import {
  previousMonthKey,
  type RecordedCashFlows,
} from "@finance/core/month-close";
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
import { buildSavingsGoalProgress } from "@finance/core/savings-goals";
import type {
  Category,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";
import { DEFAULT_LOCALE, type Locale } from "@finance/core/i18n/locale";

import {
  countPendingFeedItems,
  getBankAccounts,
  getBudgets,
  getCategories,
  getFulfilledKeys,
  getFulfilmentProposals,
  getMonthCloseOverview,
  getMonthlySummary,
  getMonthlyTrend,
  getPendingFeedItems,
  getRecentBankMovements,
  getRecordedCashFlows,
  getRecurringTemplates,
  getSavingsGoals,
  getSavingsReserve,
  getSkippedOccurrences,
  getTransactions,
  getWalletPortfolio,
  readCashBalance,
  type MonthCloseOverview,
} from "@/lib/queries";
import {
  getMonthRead,
  monthFactsFromScreen,
  monthReadWritable,
  type MonthReadView,
} from "@/lib/month-read";
import type { MonthFacts } from "@finance/core/month-facts";
import type { ReadFreshness } from "@finance/core/month-read-budget";

/**
 * The detail under a Bearing tile's figure, gathered on the phone.
 *
 * `bearing.ts` already says why the phone reads Supabase directly rather than
 * asking the web app: `bearing_arrangements` and `user_preferences` are
 * select-own under row level security, and so is every table a panel reads
 * from. That argument applies here with the same force — a panel is a read,
 * never a write, so there is no `MISTRAL_API_KEY` to keep off the phone and
 * nothing here needs a round trip through the web app.
 *
 * This module is the phone's own twin of `apps/web/lib/bearing/panel-detail.ts`
 * rather than a port of it: the two cannot share a type, because mobile
 * cannot import from the web app, and they cannot easily share the gathering
 * code either, because `@finance/core` carries no Supabase client for either
 * client to call into. That is the same shape `gatherBearingFacts` already
 * has — implemented twice, once per client, both producing the same core
 * types (`MonthPulse`, `BudgetProgress`, `ForwardProjection`, ...) from the
 * same engines in `packages/core`. Nothing judged here is new: every derived
 * figure below comes out of an engine that is already tested, and this file
 * does only the gathering — which is exactly the work `bearing.ts` already
 * does for the tiles themselves.
 */

/** Which figures a panel is asking about. Mirrors the web's `PanelScope`. */
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
 * Bundled rather than spread across the `now` branch for the reason the web
 * app gives: they are one card's props, and splitting them invites a caller
 * to pass four of the seven, which is how a card ends up stating a balance
 * beside a month it does not belong to.
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
}

/** The review queue, and the vocabulary a decision on it needs. */
export interface InboxDetail {
  items: Awaited<ReturnType<typeof getPendingFeedItems>>;
  categories: Awaited<ReturnType<typeof getCategories>>;
}

/** The stored month read, and everything the card needs to render it. */
export interface MonthReadDetail {
  read: MonthReadView["read"] | null;
  freshness: ReadFreshness | null;
  /** The figures as they stand now, in the reader's language. */
  facts: MonthFacts;
  /** The same figures, labelled in the language the read was written in. */
  readFacts: MonthFacts;
  readLocale: Locale;
  writesLeft: number;
  /** Whether a read can be written from this build at all. */
  configured: boolean;
}

type Movements = Awaited<ReturnType<typeof getRecentBankMovements>>;
type Accounts = Awaited<ReturnType<typeof getBankAccounts>>;
type Summary = Awaited<ReturnType<typeof getMonthlySummary>>;
type Trend = Awaited<ReturnType<typeof getMonthlyTrend>>;
type Portfolio = Awaited<ReturnType<typeof getWalletPortfolio>>;
type Upcoming = ReturnType<typeof buildStillToCome>;
type Budgets = ReturnType<typeof buildBudgetProgress>;

/**
 * What sits under a figure, once somebody asks to see it.
 *
 * Keyed on family so a renderer cannot read a field its branch never
 * fetched — see `panel-blocks.tsx`, whose `switch` on `detail.family` is what
 * this type actually buys: TypeScript refuses a block that reads a field its
 * family never gathers.
 */
export type PanelDetail =
  | {
      family: "now";
      hero: HeroFigures;
      comparison: MonthComparison;
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
      comparison: MonthComparison;
      upcoming: Upcoming;
      budgets: Budgets;
      pulse: MonthPulse;
      closes: MonthCloseOverview;
      trend: Trend;
      /** Null unless the panel's blocks asked for it — it is not cheap. */
      read: MonthReadDetail | null;
    }
  | { family: "run"; closes: MonthCloseOverview; pulse: MonthPulse; trend: Trend }
  | {
      family: "ahead";
      projection: ForwardProjection;
      runway: Runway;
      trend: Trend;
    }
  | { family: "wallet"; portfolio: Portfolio; weights: HoldingWeight[] };

/* ------------------------------------------------------------ the gather */

interface MonthFigures {
  summary: Summary;
  comparison: MonthComparison;
  closes: MonthCloseOverview;
  upcoming: Upcoming;
  pulse: MonthPulse;
  trend: Trend;
  hero: HeroFigures;
  /** Handed to `gatherRead` too, so it does not ask Supabase for them again. */
  templates: RecurringTemplateWithCategory[];
}

/**
 * What the month read renders against: the shared figures plus the two things
 * only the `month` family gathers.
 *
 * They travel together rather than as four more parameters because they are
 * one month's worth of state, and a caller that passed the budgets of one
 * month beside the summary of another would compile.
 */
interface ReadInput extends MonthFigures {
  budgets: Budgets;
  categories: Category[];
}

function previousMonthOf(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

/**
 * The balance a month's unrecorded spending is measured from.
 *
 * Only the close of the month immediately before counts — see `bearing.ts`
 * for the reason. Null reads as "not known yet" everywhere downstream.
 */
function openingBalanceFor(
  closes: MonthCloseOverview,
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

/**
 * One month's figures, assembled the way the Month screen assembles them.
 *
 * Shared by `now`, `month` and `run`, all three of which want some slice of
 * it. Keeping three copies of this arithmetic in step by hand is the failure
 * this prevents — a pulse built from a different opening balance than the
 * score it feeds is a figure that looks authoritative and is nonsense.
 *
 * Only the slice all three want, though. The budget rings used to be built
 * here too, which cost `now` and `run` two queries and a build for a field
 * neither of their `PanelDetail` variants even has — and the phone has no
 * request cache to absorb that. `gatherMonth` asks for them itself now.
 */
async function monthFigures(
  userId: string,
  year: number,
  month: number,
  view: BudgetViewMode,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MonthFigures> {
  const today = todayIsoLocal();
  const current = getCurrentMonth();
  const isCurrentMonth = year === current.year && month === current.month;
  const [previousYear, previousMonthNumber] = previousMonthOf(year, month);

  const [
    summary,
    closes,
    templates,
    currentTx,
    previousTx,
    skipped,
    fulfilledKeys,
    trend,
    // Only for the month in progress: a past month's balance is a figure
    // from a moment that has gone.
    cash,
    flows,
  ] = await Promise.all([
    getMonthlySummary(userId, year, month, view),
    getMonthCloseOverview(userId, today),
    getRecurringTemplates(userId),
    getTransactions(userId, year, month),
    getTransactions(userId, previousYear, previousMonthNumber),
    getSkippedOccurrences(userId, year, month),
    getFulfilledKeys(userId),
    getMonthlyTrend(userId),
    isCurrentMonth ? readCashBalance(userId, today) : Promise.resolve(null),
    isCurrentMonth
      ? getRecordedCashFlows(userId, year, month)
      : Promise.resolve(null),
  ]);

  const upcoming = buildStillToCome(
    currentTx,
    templates,
    year,
    month,
    today,
    new Set(skipped.map((entry) => `${entry.templateId}:${entry.occurredOn}`)),
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
    onHand: cash?.ok ? cash.total : null,
    committed: upcoming.leaving,
    arriving: upcoming.arriving,
    flows: flows ?? noFlows,
    openingBalance: openingBalanceFor(closes, year, month),
    cap: closes.settings.unrecordedCap,
  });

  const comparison = buildMonthComparison({
    current: currentTx,
    previous: previousTx,
    year,
    month,
    today,
    locale,
  });

  const hero: HeroFigures = {
    pulse,
    monthLabel: formatMonthLabel(year, month, locale),
    income: summary.income,
    expenses: summary.expenses,
    remaining: summary.remaining,
    budgetView: view,
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
  };

  return {
    summary,
    comparison,
    closes,
    upcoming,
    pulse,
    trend,
    hero,
    templates,
  };
}

/* ------------------------------------------------------------------ now */

async function gatherNow(
  userId: string,
  scope: PanelScope,
  blocks: readonly PanelBlock[],
  locale: Locale,
): Promise<PanelDetail> {
  // Always the month in progress, whatever the panel was scoped to — "now"
  // has no month chrome precisely because its figures are today's. `view`
  // still applies: it is the hero card's own today/month-end pill, not a
  // choice of which month to look at.
  const { year, month } = getCurrentMonth();
  const view = scope.view ?? "current";

  const [figures, movements, accounts, inbox] = await Promise.all([
    monthFigures(userId, year, month, view, locale),
    getRecentBankMovements(userId),
    getBankAccounts(userId),
    // Two reads, and only one of this family's tiles draws them: the review
    // queue is `inbox-pending`'s panel and nobody else's.
    blocks.includes("review-inbox")
      ? gatherInbox(userId, locale)
      : Promise.resolve(null),
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
  const [items, categories] = await Promise.all([
    getPendingFeedItems(userId, locale),
    getCategories(userId),
  ]);
  return { items, categories };
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
  const [figures, budgetRows, categories] = await Promise.all([
    monthFigures(userId, year, month, view, locale),
    getBudgets(userId),
    getCategories(userId),
  ]);

  const budgets = buildBudgetProgress(
    budgetRows,
    figures.summary.expenseBreakdown,
    figures.summary.expenses,
    new Map(categories.map((category) => [category.id, category.name])),
    locale,
  );

  const read = blocks.includes("month-read")
    ? await gatherRead(userId, year, month, locale, {
        ...figures,
        budgets,
        categories,
      })
    : null;

  return {
    family: "month",
    year,
    month,
    monthLabel: formatMonthLabel(year, month, locale),
    summary: figures.summary,
    comparison: figures.comparison,
    upcoming: figures.upcoming,
    budgets,
    pulse: figures.pulse,
    closes: figures.closes,
    trend: figures.trend,
    read,
  };
}

/**
 * The stored read, and everything it renders against.
 *
 * Takes the month's figures rather than re-fetching them, unlike the web
 * twin: the web app's reads are cached per request, so asking for the
 * templates twice costs one query. The phone has no such cache, so asking
 * `monthFigures` a second time would be a second round trip for the same
 * rows — this is why `MonthFigures` carries `templates` through to here, and
 * why `gatherMonth` hands over the categories and budget rings it has just
 * fetched rather than letting this ask for them again.
 */
async function gatherRead(
  userId: string,
  year: number,
  month: number,
  locale: Locale,
  figures: ReadInput,
): Promise<MonthReadDetail> {
  const current = getCurrentMonth();
  const isCurrentMonth = year === current.year && month === current.month;

  const [goals, portfolio, inboxPending, chargesUnconfirmed] =
    await Promise.all([
      getSavingsGoals(userId),
      getWalletPortfolio(userId, { includeHistory: false }),
      countPendingFeedItems(userId),
      chargesUnconfirmedCount(
        userId,
        figures.templates,
        figures.categories,
        year,
        month,
      ),
    ]);

  const factsInput = {
    year,
    month,
    isCurrentMonth,
    summary: figures.summary,
    comparison: figures.comparison,
    closes: figures.closes,
    // Only a month in progress has a live pulse to render — see `month.tsx`,
    // which withholds it from the fact pack the same way.
    pulse: isCurrentMonth ? figures.pulse : null,
    budgets: figures.budgets,
    goals: buildSavingsGoalProgress(
      goals,
      figures.summary.savingsBreakdown,
      figures.summary.savings,
    ),
    investedValue: portfolio.totalMarketValue,
    inboxPending,
    chargesUnconfirmed,
  };

  const facts = monthFactsFromScreen({ ...factsInput, locale });

  let stored: Awaited<ReturnType<typeof getMonthRead>> = {
    view: null,
    writesLeft: 0,
    tracked: false,
  };
  try {
    stored = await getMonthRead(userId, year, month, facts);
  } catch {
    // A read that could not be fetched is not a reason to lose the panel.
  }

  // A read stays in the language it was written in, so its figures have to
  // be labelled in that language too. Built only when the two have actually
  // come apart, which is rare and only after a locale switch.
  const readLocale = stored.view?.locale ?? locale;
  const readFacts =
    readLocale === locale
      ? facts
      : monthFactsFromScreen({ ...factsInput, locale: readLocale });

  return {
    read: stored.view?.read ?? null,
    freshness: stored.view?.freshness ?? null,
    facts,
    readFacts,
    readLocale,
    writesLeft: stored.writesLeft,
    configured: monthReadWritable(),
  };
}

async function chargesUnconfirmedCount(
  userId: string,
  templates: RecurringTemplateWithCategory[],
  categories: Category[],
  year: number,
  month: number,
): Promise<number> {
  try {
    const proposals = await getFulfilmentProposals(
      userId,
      templates,
      categories,
      year,
      month,
    );
    return proposals.length;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ run */

async function gatherRun(userId: string, scope: PanelScope): Promise<PanelDetail> {
  // The run is measured in closed months, so the shelf and the streak are
  // the whole history rather than the scoped month's slice of it.
  // `monthFigures` already fetches the trend, so asking for it again here was
  // the same query twice on the same path — and the phone has no request
  // cache to collapse the two.
  const figures = await monthFigures(
    userId,
    scope.year,
    scope.month,
    "current",
  );

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
      // whatever that account holds, so it is not a balance.
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

/**
 * What sits under a figure, fetched only when somebody asks to see it.
 *
 * One branch per family rather than one per tile, for the reason the web
 * twin gives: two tiles in the same family want the same underlying rows
 * even when `bearing-panels.ts` shows them different blocks. `blocks` is the
 * exception, and it is narrow on purpose — a hint about work, never about
 * access, since every branch reads only this user's own rows.
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
      return gatherNow(userId, scope, blocks, locale);
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

/* ------------------------------------------------------------- the cache */

const cache = new Map<string, PanelDetail>();

/**
 * Includes `blocks` because two tiles can share a family and a scope while
 * wanting different detail — `free` and `savings-rate` are both `month`, but
 * only `free`'s blocks ask for the read. Keying on the block list rather than
 * the tile id is deliberate: tiles that ask for the *same* blocks — the three
 * `unrecorded-*` tiles all ask for `["budget-progress","month-score"]` — are
 * meant to share one fetch, which is the same argument `gatherPanelDetail`
 * makes for branching on family rather than on tile.
 *
 * Includes `locale` too: the detail carries month names and other rendered
 * words, not just numbers, so what was fetched in French is wrong to hand
 * back after the reader switches to English.
 */
function keyOf(
  userId: string,
  family: FactFamily,
  scope: PanelScope,
  blocks: readonly PanelBlock[],
  locale: Locale,
): string {
  return `${userId}:${family}:${scope.year}-${scope.month}:${scope.view ?? "current"}:${scope.horizon ?? ""}:${blocks.join(",")}:${locale}`;
}

/**
 * The detail under a figure, fetched once per family per scope.
 *
 * Cached for the session because an accordion invites reopening: a reader
 * expands `free`, collapses it to check `streak`, and comes back. Asking
 * Supabase again for rows that cannot have changed in those four seconds
 * would make the second open slower than the first, which reads as the app
 * getting worse the more you use it.
 *
 * Null on failure rather than a thrown error: the figure already on screen
 * is still true, and a panel that cannot explain it should say so quietly
 * rather than crash the row it is sitting in.
 */
export async function getPanelDetail(
  userId: string,
  family: FactFamily,
  scope: PanelScope,
  blocks: readonly PanelBlock[],
  locale: Locale,
): Promise<PanelDetail | null> {
  const key = keyOf(userId, family, scope, blocks, locale);
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }

  try {
    const detail = await gatherPanelDetail(userId, family, scope, blocks, locale);
    cache.set(key, detail);
    return detail;
  } catch {
    return null;
  }
}

/**
 * The cached detail, if reopening this exact scope would be instant.
 *
 * Read synchronously so a panel can seed its first render from the cache
 * rather than from `null` — without this, reopening a tile still shows one
 * frame of skeleton before the effect below resolves the same value it could
 * have had immediately.
 */
export function peekPanelDetail(
  userId: string,
  family: FactFamily,
  scope: PanelScope,
  blocks: readonly PanelBlock[],
  locale: Locale,
): PanelDetail | null {
  return cache.get(keyOf(userId, family, scope, blocks, locale)) ?? null;
}

/** Called by `notifyDataChanged` consumers, so a write is not read stale. */
export function clearPanelCache(): void {
  cache.clear();
}
