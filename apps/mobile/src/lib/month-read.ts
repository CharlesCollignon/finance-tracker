import { monthColumnValue } from "@finance/core/month-close";
import {
  describeReadFreshness,
  writesRemaining,
  type ReadFreshness,
} from "@finance/core/month-read-budget";
import { readFooting, type MonthRead } from "@finance/core/month-read";
import { buildMonthFacts, type MonthFacts } from "@finance/core/month-facts";
import type { BudgetProgress } from "@finance/core/budget-limits";
import type { MonthComparison } from "@finance/core/month-comparison";
import type { buildMonthPulse } from "@finance/core/month-pulse";
import type { SavingsGoalProgress } from "@finance/core/savings-goals";
import type {
  MonthlySummary,
  MonthReadRow,
} from "@finance/core/types/database";
import type { MonthCloseOverview } from "@/lib/queries";

import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * The month read on the phone.
 *
 * Reading needs no server of ours: `month_reads` is select-own under row
 * level security, so the row comes straight out of Supabase like every other
 * query — no round trip through the web app, and the card still works with
 * the network down.
 *
 * Writing does need one, and only for one reason: `MISTRAL_API_KEY` lives in
 * the web server's environment and must never reach a phone. So a press posts
 * to `/api/month-read` with the Supabase access token the app already holds,
 * exactly as the bank refresh does.
 */

/**
 * A fact pack from what the Month screen already fetched.
 *
 * The web app has a `gatherMonthFacts` that runs a dozen queries of its own,
 * because a route has nothing to hand. The screen here has all of it already
 * in one batch, so this is a mapping rather than a gather — and it means the
 * figures the read refers to are literally the ones rendered above it.
 */
export function monthFactsFromScreen(input: {
  year: number;
  month: number;
  isCurrentMonth: boolean;
  summary: MonthlySummary;
  comparison: MonthComparison | null;
  closes: MonthCloseOverview;
  pulse: ReturnType<typeof buildMonthPulse> | null;
  budgets: readonly BudgetProgress[];
  goals: readonly SavingsGoalProgress[];
  investedValue: number;
  inboxPending: number;
  chargesUnconfirmed: number;
}): MonthFacts {
  const monthKey = `${input.year}-${String(input.month).padStart(2, "0")}`;
  const closed =
    input.closes.history.find((row) => row.monthKey === monthKey) ?? null;

  return buildMonthFacts({
    year: input.year,
    month: input.month,
    state: input.isCurrentMonth
      ? "in-progress"
      : closed
        ? "closed"
        : "past-open",
    summary: input.summary,
    comparison: input.comparison,
    close: closed
      ? {
          monthKey: closed.monthKey,
          unrecorded: closed.unrecorded,
          kept: closed.kept,
          keptRate: closed.keptRate,
          cashChange: closed.cashChange,
        }
      : null,
    pulse: input.pulse,
    closeSummary: input.closes.summary,
    unrecordedCap: input.closes.settings.unrecordedCap,
    budgets: input.budgets,
    goals: input.goals,
    investedValue: input.investedValue,
    inboxPending: input.inboxPending,
    chargesUnconfirmed: input.chargesUnconfirmed,
  });
}

export interface MonthReadView {
  read: MonthRead;
  writtenAt: string;
  freshness: ReadFreshness;
}

/** Whether an error means migration 024 has not run. */
function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

export interface StoredMonthRead {
  view: MonthReadView | null;
  writesLeft: number;
  /** False when migration 024 has not run. */
  tracked: boolean;
}

export async function getMonthRead(
  userId: string,
  year: number,
  month: number,
  currentFacts: MonthFacts,
): Promise<StoredMonthRead> {
  const { data, error } = await supabase
    .from("month_reads")
    .select("*")
    .eq("user_id", userId)
    .eq("month", monthColumnValue(year, month))
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return { view: null, writesLeft: 0, tracked: false };
    }
    throw error;
  }

  const row = data as MonthReadRow | null;
  const tally = row
    ? {
        writes: row.writes,
        refused: row.refused,
        lastWrittenAt: row.last_written_at,
        pendingSince: row.pending_since,
      }
    : null;

  const read = (row?.read as MonthRead | null) ?? null;
  const storedFacts = (row?.facts as MonthFacts | null) ?? null;

  if (!row || !read || !storedFacts || !row.written_at) {
    return { view: null, writesLeft: writesRemaining(tally), tracked: true };
  }

  return {
    view: {
      read,
      writtenAt: row.written_at,
      freshness: describeReadFreshness({
        storedFacts,
        currentFacts,
        footing: readFooting(read),
        writtenAt: row.written_at,
        now: new Date().toISOString(),
      }),
    },
    writesLeft: writesRemaining(tally),
    tracked: true,
  };
}

export interface WriteOutcome {
  written: boolean;
  message: string | null;
  writesLeft: number | null;
}

/** Whether a read can be written from this build at all. */
export function monthReadWritable(): boolean {
  return WEB_APP_URL !== null;
}

/** Long enough for a model to answer, short enough not to hang a press. */
const TIMEOUT_MS = 45_000;

export async function writeMonthRead(
  year: number,
  month: number,
): Promise<WriteOutcome> {
  const quiet: WriteOutcome = {
    written: false,
    message: null,
    writesLeft: null,
  };

  if (!WEB_APP_URL) {
    return quiet;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return quiet;
  }

  // An explicit controller rather than AbortSignal.timeout, for the same
  // reason the bank client uses one: a build without it would hang the
  // spinner rather than fail.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${WEB_APP_URL}/api/month-read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ year, month }),
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => null)) as {
      written?: boolean;
      message?: string;
      error?: string;
      writesLeft?: number;
    } | null;

    if (!response.ok) {
      // Reported rather than thrown: the read already on screen is still
      // perfectly readable.
      return {
        written: false,
        message: body?.error ?? "Could not write the read just now.",
        writesLeft: null,
      };
    }

    return {
      written: body?.written ?? false,
      message: body?.message ?? null,
      writesLeft: body?.writesLeft ?? null,
    };
  } catch {
    return {
      written: false,
      message: "Could not write the read just now.",
      writesLeft: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
