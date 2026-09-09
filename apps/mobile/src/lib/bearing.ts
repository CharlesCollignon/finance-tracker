import { buildAllocation } from "@finance/core/allocation";
import { buildBearing } from "@finance/core/bearing";
import {
  arrangementsRemaining,
  describeArrangementFreshness,
  type ArrangementFreshness,
} from "@finance/core/bearing-budget";
import {
  buildBearingFacts,
  type BearingFacts,
} from "@finance/core/bearing-facts";
import {
  arrangementFooting,
  type Arrangement,
} from "@finance/core/bearing-read";
import { mergeArrangement, type TilePins } from "@finance/core/bearing-tiles";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { buildFundCosts } from "@finance/core/fund-costs";
import { buildInvestmentReturns } from "@finance/core/investment-returns";
import { buildWalletFundingNeeds } from "@finance/core/investment-upcoming";
import { buildMonthComparison } from "@finance/core/month-comparison";
import { buildMonthPulse } from "@finance/core/month-pulse";
import { previousMonthKey } from "@finance/core/month-close";
import {
  buildForwardProjection,
  buildRunway,
  summarizeProjection,
} from "@finance/core/projection";
import { buildStillToCome } from "@finance/core/still-to-come";
import type { BearingArrangementRow } from "@finance/core/types/database";
import {
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";

import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import {
  countPendingFeedItems,
  getFulfilledKeys,
  getInvestmentTransactions,
  getMonthCloseOverview,
  getMonthlySummary,
  getMonthlyTrend,
  getRecurringTemplates,
  getSavingsReserve,
  getSkippedOccurrences,
  getTransactions,
  getWalletPlans,
  getWalletPortfolio,
  hasBankFeed,
  readCashBalance,
} from "@/lib/queries";

/**
 * The Bearing on the phone.
 *
 * Reading needs no server of ours: `bearing_arrangements` and
 * `user_preferences` are both select-own under row level security, so the
 * rows come straight out of Supabase like every other query — no round trip
 * through the web app, and the screen still works with the network down.
 *
 * Two things do need one. `MISTRAL_API_KEY` lives in the web server's
 * environment and must never reach a phone, so arranging posts to
 * `/api/bearing` with the Supabase access token the app already holds,
 * exactly as the month read and the bank refresh do. Saving pins could go
 * direct — that column *is* client-writable — but goes through the same route
 * so that one validation stands between every client and it.
 *
 * The fact pack is gathered here rather than mapped off the screen, which is
 * the opposite of what `month-read.ts` does and worth saying why. A month
 * read's figures are the ones rendered above it on the same screen, so
 * mapping them is what guarantees they agree. The Bearing's figures *are* the
 * screen, so there is nothing above to agree with — and gathering them in one
 * place means the phone and the web app run the same assembly over the same
 * engines.
 */

/** Whether an error means migration 029 has not run. */
function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

export async function gatherBearingFacts(
  userId: string,
  locale: Locale,
): Promise<BearingFacts> {
  const today = todayIsoLocal();
  const { year, month } = getCurrentMonth();
  const [previousYear, previousMonthNumber] = previousMonthOf(year, month);

  const [
    summary,
    closes,
    templates,
    currentTx,
    previousTx,
    skipped,
    fulfilledKeys,
    portfolio,
    plans,
    investmentTransactions,
    trend,
    reserve,
    bankFed,
  ] = await Promise.all([
    getMonthlySummary(userId, year, month, "current"),
    getMonthCloseOverview(userId, today),
    getRecurringTemplates(userId),
    getTransactions(userId, year, month),
    getTransactions(userId, previousYear, previousMonthNumber),
    getSkippedOccurrences(userId, year, month),
    getFulfilledKeys(userId),
    getWalletPortfolio(userId),
    getWalletPlans(userId),
    getInvestmentTransactions(userId),
    getMonthlyTrend(userId),
    getSavingsReserve(userId),
    hasBankFeed(userId),
  ]);

  const [cash, pending] = await Promise.all([
    readCashBalance(userId, today),
    bankFed ? countPendingFeedItems(userId) : Promise.resolve(0),
  ]);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  // The same adjacency rule every other surface uses: only the close of the
  // month immediately before can be measured from, or the arithmetic compares
  // a balance against transactions from a different window.
  const latest = closes.history[0];
  const openingBalance =
    latest && latest.monthKey === previousMonthKey(monthKey)
      ? latest.closingBalance
      : null;

  const upcoming = buildStillToCome(
    currentTx,
    templates,
    year,
    month,
    today,
    new Set(skipped.map((entry) => `${entry.templateId}:${entry.occurredOn}`)),
    fulfilledKeys,
  );

  const onHand = cash?.ok ? cash.total : null;

  const pulse = buildMonthPulse({
    onHand,
    committed: upcoming.leaving,
    arriving: upcoming.arriving,
    flows: {
      income: summary.income,
      expenses: summary.expenses,
      savings: summary.savings,
      transfers: summary.investmentDeployments,
    },
    openingBalance,
    cap: closes.settings.unrecordedCap,
  });

  const planByWallet = new Map(plans.map((plan) => [plan.wallet, plan]));

  return buildBearingFacts({
    asOf: today,
    bearing: buildBearing({
      onHand,
      positions: portfolio.columns.flatMap((column) =>
        column.items.map((item) => ({
          name: item.name,
          marketValue: item.marketValue,
        })),
      ),
    }),
    pulse,
    summary,
    comparison: buildMonthComparison({
      current: currentTx,
      previous: previousTx,
      year,
      month,
      today,
      locale,
    }),
    closeSummary: closes.summary,
    unrecordedCap: closes.settings.unrecordedCap,
    projection: summarizeProjection(
      buildForwardProjection(templates, year, month, { months: 12 }),
    ),
    runway: buildRunway(reserve, templates, year, month),
    trend: trend.map((point) => point.net),
    returns: buildInvestmentReturns(investmentTransactions, portfolio, today),
    allocation: buildAllocation(
      portfolio.columns.map((column) => ({
        walletId: column.walletId,
        value: column.totalMarketValue,
      })),
      portfolio.columns.map((column) => {
        const target = planByWallet.get(column.walletId)?.target_weight;
        return {
          walletId: column.walletId,
          targetWeight:
            target === null || target === undefined ? null : Number(target),
        };
      }),
    ),
    costs: buildFundCosts(
      portfolio.columns.flatMap((column) =>
        column.items.map((item) => ({
          positionId: item.id,
          name: item.name,
          walletId: item.walletId,
          marketValue: item.marketValue,
          ongoingCharge: item.ongoingCharge,
        })),
      ),
    ),
    contributionPace: buildWalletFundingNeeds(
      templates.filter((template) => template.categories.type === "investment"),
      year,
      month,
    ).reduce((sum, need) => sum + need.monthlyTotal, 0),
    inboxPending: pending,
    locale,
  });
}

function previousMonthOf(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

/* ------------------------------------------------------------- the store */

export interface StoredBearing {
  arrangement: Arrangement | null;
  /** The language the captions are in, which may not be the reader's. */
  locale: Locale;
  freshness: ArrangementFreshness | null;
  arrangementsLeft: number;
  /** False when migration 029 has not run. */
  tracked: boolean;
}

export async function getBearingArrangement(
  userId: string,
  currentFacts: BearingFacts,
): Promise<StoredBearing> {
  const { data, error } = await supabase
    .from("bearing_arrangements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return {
        arrangement: null,
        locale: DEFAULT_LOCALE,
        freshness: null,
        arrangementsLeft: 0,
        tracked: false,
      };
    }
    throw error;
  }

  const row = data as BearingArrangementRow | null;
  const { year, month } = getCurrentMonth();
  const thisMonth = `${year}-${String(month).padStart(2, "0")}-01`;

  const tally = row
    ? {
        // A tally from a month that has passed is not this month's tally. The
        // database resets it on the next reservation; a screen rendered
        // before that would otherwise say "0 left" on the first of the month.
        writes: row.tally_month < thisMonth ? 0 : row.writes,
        refused: row.refused,
        lastWrittenAt: row.last_written_at,
        pendingSince: row.pending_since,
      }
    : null;

  const arrangement = (row?.arrangement as Arrangement | null) ?? null;
  const storedFacts = (row?.facts as BearingFacts | null) ?? null;

  return {
    arrangement,
    locale: parseLocale(row?.locale) ?? DEFAULT_LOCALE,
    freshness:
      arrangement && storedFacts && row?.arranged_at
        ? describeArrangementFreshness({
            storedFacts,
            currentFacts,
            footing: arrangementFooting(arrangement),
            arrangedAt: row.arranged_at,
            now: new Date().toISOString(),
          })
        : null,
    arrangementsLeft: arrangementsRemaining(tally),
    tracked: true,
  };
}

/** Where the user has put their tiles, from the preferences row. */
export async function getBearingPins(userId: string): Promise<TilePins> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("bearing_pins")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return {};
    }
    throw error;
  }

  const raw = data?.bearing_pins;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const pins: Record<string, number> = {};
  for (const [id, slot] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof slot === "number" && Number.isInteger(slot) && slot >= 0) {
      pins[id] = slot;
    }
  }
  return pins;
}

/** The order to draw, arrangement and pins already reconciled. */
export function bearingOrder(
  arrangement: Arrangement | null,
  pins: TilePins,
  facts: BearingFacts,
) {
  return mergeArrangement(
    arrangement?.tiles.map((tile) => tile.id) ?? [],
    pins,
    facts,
  );
}

/* ------------------------------------------------------------ the writes */

/** Whether this build can reach a model at all. */
export function bearingWritable(): boolean {
  return WEB_APP_URL !== null;
}

export interface ArrangeOutcome {
  arranged: boolean;
  message: string | null;
  arrangementsLeft: number | null;
}

/** Long enough for a model to answer, short enough not to hang a press. */
const TIMEOUT_MS = 45_000;

async function callWebApp(
  method: "POST" | "PUT",
  body: unknown,
): Promise<Response | null> {
  if (!WEB_APP_URL) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return null;
  }

  // An explicit controller rather than AbortSignal.timeout, for the same
  // reason the bank client uses one: a build without it would hang the
  // spinner rather than fail.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(`${WEB_APP_URL}/api/bearing`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function arrangeBearing(): Promise<ArrangeOutcome> {
  const quiet: ArrangeOutcome = {
    arranged: false,
    message: null,
    arrangementsLeft: null,
  };

  try {
    const response = await callWebApp("POST", {});
    if (!response) {
      return quiet;
    }

    const body = (await response.json().catch(() => null)) as {
      arranged?: boolean;
      message?: string;
      error?: string;
      arrangementsLeft?: number;
    } | null;

    if (!response.ok) {
      // Reported rather than thrown: the tiles already on screen are still
      // perfectly readable.
      return {
        arranged: false,
        message: body?.error ?? "Could not arrange just now.",
        arrangementsLeft: null,
      };
    }

    return {
      arranged: body?.arranged ?? false,
      message: body?.message ?? null,
      arrangementsLeft: body?.arrangementsLeft ?? null,
    };
  } catch {
    return {
      arranged: false,
      message: "Could not arrange just now.",
      arrangementsLeft: null,
    };
  }
}

/**
 * Remember where the user put their tiles.
 *
 * Silent on failure, and deliberately: the tile has already moved under the
 * finger, the cost of losing the position is dragging it again, and a toast
 * for it would interrupt the one gesture on this screen that should feel
 * immediate.
 */
export async function saveBearingPins(pins: TilePins): Promise<boolean> {
  try {
    const response = await callWebApp("PUT", { pins });
    return response?.ok ?? false;
  } catch {
    return false;
  }
}
