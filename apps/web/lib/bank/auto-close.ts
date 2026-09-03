import {
  buildMonthClose,
  closableMonth,
  monthColumnValue,
  monthKeyOfClose,
  observationDateFor,
  previousMonthKey,
  type MonthCloseResult,
} from "@finance/core/month-close";
import { todayIsoLocal } from "@finance/core/constants";
import type { Database } from "@finance/core/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecordedCashFlows } from "@/lib/queries/month-close";
import { readCashBalance } from "@/lib/queries/bank-balance";

type Client = SupabaseClient<Database>;

/** Enough to walk a new connection's whole history in one run. */
const MAX_MONTHS = 30;

export interface AutoCloseOutcome {
  closed: {
    monthKey: string;
    closingBalance: number;
    result: MonthCloseResult;
  }[];
  /** Why it stopped, when it stopped for a reason worth reporting. */
  blocked:
    | null
    | { kind: "not-configured" }
    | { kind: "nothing-due" }
    | { kind: "not-yet"; observeOn: string }
    | { kind: "unreadable"; accounts: string[] };
}

/**
 * Close the months the statement can already answer for.
 *
 * The month close asks for one figure the app cannot derive: what the account
 * actually held. Where a bank is connected it can be derived after all — the
 * last movement of the observation day carries that day's balance — so this
 * does what the user was being asked to do by hand, and does it for every
 * month at once rather than one a month.
 *
 * Two things it will not do. It will not close a month it cannot read every
 * counted account for, because a lapsed consent reads as an empty account and
 * would invent thousands of euros of unrecorded spending to explain the hole.
 * And it will not skip a month: each close measures from the one before it, so
 * a gap would compare a balance against a different window's transactions.
 *
 * Runs under whatever client it is handed — the service role on the cron, the
 * user's own session after a manual sync — and writes nothing when there is
 * nothing it can be sure of.
 */
export async function autoCloseMonths(
  supabase: Client,
  userId: string,
): Promise<AutoCloseOutcome> {
  const outcome: AutoCloseOutcome = { closed: [], blocked: null };
  const today = todayIsoLocal();

  const { data: settingsRow } = await supabase
    .from("month_close_settings")
    .select("close_day")
    .eq("user_id", userId)
    .maybeSingle();
  const closeDay = settingsRow?.close_day ?? 5;

  // One probe before any work: with no counted accounts this is simply not
  // set up, which is not a failure.
  const probe = await readCashBalance(userId, today, supabase);
  if (probe === null) {
    outcome.blocked = { kind: "not-configured" };
    return outcome;
  }

  for (let step = 0; step < MAX_MONTHS; step += 1) {
    const { data: closes } = await supabase
      .from("month_closes")
      .select("month")
      .eq("user_id", userId)
      .order("month", { ascending: true });

    const lastClosed =
      closes && closes.length > 0
        ? monthKeyOfClose(closes[closes.length - 1]!.month)
        : null;

    const next = closableMonth(today, closeDay, lastClosed);
    if (!next) {
      outcome.blocked = outcome.blocked ?? { kind: "nothing-due" };
      return outcome;
    }

    if (today < next.observeOn) {
      outcome.blocked = { kind: "not-yet", observeOn: next.observeOn };
      return outcome;
    }

    const closing = await readCashBalance(userId, next.observeOn, supabase);
    if (!closing || !closing.ok) {
      outcome.blocked = {
        kind: "unreadable",
        accounts: (closing?.missing ?? []).map((entry) => entry.label),
      };
      return outcome;
    }

    // The opening figure: a stored close where there is one, otherwise the
    // statement again. Reading both ends is what lets the very first month
    // reconcile instead of being spent as a baseline — the whole reason the
    // manual flow needed a throwaway first close.
    let openingBalance: number | null = null;
    if (lastClosed !== null) {
      const { data: previous } = await supabase
        .from("month_closes")
        .select("closing_balance")
        .eq("user_id", userId)
        .eq("month", monthColumnValue(...monthKeyParts(lastClosed)))
        .maybeSingle();
      openingBalance =
        previous?.closing_balance === undefined
          ? null
          : Number(previous.closing_balance);
    } else {
      const priorKey = previousMonthKey(next.monthKey);
      const [priorYear, priorMonth] = monthKeyParts(priorKey);
      const opening = await readCashBalance(
        userId,
        observationDateFor(priorYear, priorMonth, closeDay),
        supabase,
      );
      openingBalance = opening?.ok ? opening.total : null;
    }

    const flows = await getRecordedCashFlows(
      userId,
      next.year,
      next.month,
      supabase,
    );
    const result = buildMonthClose({
      openingBalance,
      closingBalance: closing.total,
      flows,
    });

    const { error } = await supabase.from("month_closes").upsert(
      {
        user_id: userId,
        month: monthColumnValue(next.year, next.month),
        closing_balance: closing.total,
        observed_on: next.observeOn,
        balance_source: "bank",
      },
      { onConflict: "user_id,month" },
    );

    if (error) {
      throw error;
    }

    outcome.closed.push({
      monthKey: next.monthKey,
      closingBalance: closing.total,
      result,
    });
  }

  return outcome;
}

function monthKeyParts(monthKey: string): [number, number] {
  const [year, month] = monthKey.split("-").map(Number);
  return [year!, month!];
}
