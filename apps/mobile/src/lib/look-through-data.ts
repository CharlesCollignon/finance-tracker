import type { WriterState } from "@finance/core/ai-models";
import { isMissingSchema } from "@finance/data/schema";
import {
  INVESTMENT_WALLET_IDS,
  type InvestmentWalletId,
} from "@finance/core/investments";
import { wrapperFeesFromPlans } from "@finance/core/fund-costs";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import {
  buildLookThrough,
  type LookThrough,
  type LookThroughPosition,
} from "@finance/core/look-through";
import {
  buildLookThroughFacts,
  type LookThroughFacts,
} from "@finance/core/look-through-facts";
import {
  buildTargetAllocation,
  defaultAssignments,
  type TargetAllocation,
} from "@finance/core/look-through-target";
import {
  readingQueue,
  type InstrumentReadStatus,
} from "@finance/core/instrument-reading";
import type { WalletRead } from "@finance/core/wallet-read";
import type { MonthReadTally } from "@finance/core/month-read-budget";
import { monthColumnValue } from "@finance/core/month-close";
import { getCurrentMonth } from "@finance/core/constants";
import {
  FALLBACK_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import type { WalletReadRow } from "@finance/core/types/database";

import { WEB_APP_URL } from "@/lib/env";
import { getWriterState } from "@/lib/ai-writer";
import { getWalletPlans, getWalletPortfolio } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import * as readings from "@finance/data/instrument-readings";
import { announcingFetch } from "@/lib/data-version";

/**
 * The look-through, assembled on the phone.
 *
 * The same arithmetic the web's `lib/wallet-read/facts.ts` does, over the same
 * tables read through the same row level security: positions, wallet plans,
 * what has been read about each instrument, and the stored wallet read. None
 * of it needs the web — the figures are arithmetic the app does itself. Only
 * the two things that spend a model call go through the web, which holds the
 * key: writing a wallet read, and reading an instrument.
 *
 * Tolerant of migrations 032 and 033 not having run, as the web is: a missing
 * table is a portfolio nothing is known about, and the surface says so.
 */

function getInstrumentReadings(
  userId: string,
): Promise<readings.InstrumentReadings> {
  return readings.getInstrumentReadings(supabase, userId);
}

export interface StoredWalletRead {
  read: WalletRead | null;
  factsDigest: string | null;
  readAt: string | null;
  model: string | null;
  /** The language the prose was written in, which its labels must keep. */
  locale: Locale;
  tally: MonthReadTally;
}

async function getStoredWalletRead(
  userId: string,
): Promise<{ stored: StoredWalletRead | null; tracked: boolean }> {
  const { data, error } = await supabase
    .from("wallet_reads")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return { stored: null, tracked: false };
    }
    throw error;
  }
  if (!data) {
    return { stored: null, tracked: true };
  }

  const row = data as WalletReadRow;
  const { year, month } = getCurrentMonth();
  const current = monthColumnValue(year, month);
  return {
    stored: {
      read: (row.read as WalletRead | null) ?? null,
      factsDigest: row.facts_digest,
      readAt: row.read_at,
      model: row.model,
      locale: parseLocale(row.locale) ?? FALLBACK_LOCALE,
      tally: {
        // Last month's tally is not this month's; the database resets it on
        // the next reservation, but until then it would say "none left".
        writes: row.tally_month < current ? 0 : row.writes,
        refused: row.refused,
        lastWrittenAt: row.last_written_at,
        pendingSince: row.pending_since,
      },
    },
    tracked: true,
  };
}

export interface LookThroughData {
  portfolio: InvestmentPortfolioSummary;
  lookThrough: LookThrough;
  facts: LookThroughFacts;
  /** The app's own target, used until a read proposes one. */
  defaultTarget: TargetAllocation;
  positions: LookThroughPosition[];
  /** ISINs worth reading next, worst first. */
  queue: string[];
  stored: StoredWalletRead | null;
  /** False when migration 033 has not run: no Review button then. */
  readsTracked: boolean;
  /** Who would write the review and read the instruments. */
  writer: WriterState;
}

/** Everything the look-through screen draws, computed here. */
export async function getLookThroughData(
  userId: string,
  locale: Locale,
  now: Date = new Date(),
): Promise<LookThroughData> {
  const [portfolio, plans, readings, walletRead, writer] = await Promise.all([
    // History is not needed: nothing here is a time series.
    getWalletPortfolio(userId, locale, { includeHistory: false }),
    getWalletPlans(userId),
    getInstrumentReadings(userId),
    getStoredWalletRead(userId),
    getWriterState(userId),
  ]);

  const positions: LookThroughPosition[] = [];
  for (const column of portfolio.columns) {
    for (const item of column.items) {
      positions.push({
        positionId: item.id,
        name: item.name,
        walletId: column.walletId,
        isin: item.isin,
        marketValue: item.marketValue,
        ongoingCharge: item.ongoingCharge,
      });
    }
  }

  const lookThrough = buildLookThrough({
    positions,
    readings: readings.byIsin,
    envelopeFees: wrapperFeesFromPlans(plans),
    now,
  });

  const defaultTarget = buildTargetAllocation(
    defaultAssignments(
      lookThrough,
      positions.map((position) => ({
        isin: position.isin,
        walletId: position.walletId,
      })),
    ),
  );

  const walletsInUse: InvestmentWalletId[] = INVESTMENT_WALLET_IDS.filter(
    (walletId) =>
      positions.some(
        (position) =>
          position.walletId === walletId && position.marketValue > 0,
      ),
  );

  const held = positions.filter((position) => position.marketValue > 0);

  return {
    portfolio,
    lookThrough,
    facts: buildLookThroughFacts(lookThrough, defaultTarget, walletsInUse),
    defaultTarget,
    positions,
    queue: readingQueue(
      [
        ...new Set(
          held
            .map((position) => position.isin)
            .filter((isin): isin is string => isin !== null),
        ),
      ],
      readings.byIsin,
      now,
    ),
    stored: walletRead.stored,
    readsTracked: walletRead.tracked,
    writer,
  };
}

const TIMEOUT_MS = 60_000;

async function postToWeb<T>(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; body: T | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!WEB_APP_URL || !token) {
    return { ok: false, status: 401, body: null };
  }

  // An explicit controller, as the other web calls use: a build without
  // AbortSignal.timeout would hang the spinner rather than fail.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await announcingFetch(`${WEB_APP_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const parsed = (await response.json().catch(() => null)) as T | null;
    return { ok: response.ok, status: response.status, body: parsed };
  } catch {
    return { ok: false, status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

export interface WalletReviewOutcome {
  read: boolean;
  /** A sentence or a message key; the toast resolves either. */
  message: string | null;
}

/**
 * Ask the web to write a wallet read — `POST /api/wallet-read`, the route
 * the web's own Review button shares its order of operations with.
 */
export async function reviewWallets(): Promise<WalletReviewOutcome> {
  const result = await postToWeb<{
    read?: boolean;
    message?: string | null;
    error?: string;
  }>("/api/wallet-read", {});

  if (!result.ok) {
    return {
      read: false,
      message:
        result.status === 401
          ? "lookThrough.halt.signedOut"
          : (result.body?.error ?? "walletRead.noAnswer"),
    };
  }
  return {
    read: result.body?.read ?? false,
    message: result.body?.message ?? null,
  };
}

/**
 * Read one instrument through the web — `POST /api/instrument-reading`.
 *
 * The phone names the instrument itself rather than letting the route pick
 * the head of its queue: a walk that has given up on an instrument must be
 * able to ask for the one behind it, which the web's server action does with
 * a skip list and this route does not take.
 */
export async function readInstrumentThroughWeb(
  isin: string,
): Promise<InstrumentReadStatus> {
  const result = await postToWeb<{ status?: InstrumentReadStatus }>(
    "/api/instrument-reading",
    { isin },
  );
  if (result.status === 401) {
    return "not-authenticated";
  }
  // A route that did not answer is the provider being down, as far as the
  // walk is concerned: every instrument behind this one would fail the same.
  return result.body?.status ?? "provider-down";
}
