import {
  buildMonthClose,
  closableMonth,
  closeAccountsChange,
  monthColumnValue,
  monthKeyOfClose,
  previousMonthKey,
  type MonthCloseResult,
} from "@finance/core/month-close";
import { lastDayIsoOfMonth, todayIsoLocal } from "@finance/core/constants";
import type { Database } from "@finance/core/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecordedCashFlows } from "@/lib/queries/month-close";
import {
  getBankAccounts,
  readAccountBalances,
  readCashBalance,
} from "@/lib/queries/bank-balance";
import { DEFAULT_LOCALE } from "@finance/core/i18n/locale";

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

    // Only the month key is used here, never its label.
    const next = closableMonth(today, closeDay, lastClosed, DEFAULT_LOCALE);
    if (!next) {
      outcome.blocked = outcome.blocked ?? { kind: "nothing-due" };
      return outcome;
    }

    if (today < next.observeOn) {
      outcome.blocked = { kind: "not-yet", observeOn: next.observeOn };
      return outcome;
    }

    // The last day of the month, not the day the month is looked at.
    //
    // A manual close reads the balance a few days into the following month,
    // because a person cannot look up what their account held on a date that
    // has passed and because a deferred-debit card lands late. Neither
    // applies to a statement: it holds every past day, and the transactions
    // this balance is checked against are the ones dated inside the month.
    // Reading on the fifth would compare a sixth-to-fifth balance movement
    // against a first-to-thirty-first set of transactions, and the gap
    // between those two windows — the first few days of each month, one of
    // which usually holds a salary — would be reported as unrecorded
    // spending.
    //
    // Waiting until the fifth to *do* the close is still right, and is what
    // `closableMonth` above decides. That is about the statement being
    // settled, not about which day the figure comes from.
    const closesOn = lastDayIsoOfMonth(next.year, next.month);
    const closing = await readCashBalance(userId, closesOn, supabase);
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
    //
    // When the accounts this close sums are not the ones the last close
    // summed — one ticked since, or let go — the last close's figure is
    // corrected by what those accounts held on its day, and kept on this
    // close so the history compares the same way.
    const summed = closing.per.map((entry) => entry.accountId).sort();
    let openingBalance: number | null = null;
    let ownOpening: number | null = null;
    if (lastClosed !== null) {
      const { data: previous } = await supabase
        .from("month_closes")
        .select("closing_balance, observed_on, bank_accounts")
        .eq("user_id", userId)
        .eq("month", monthColumnValue(...monthKeyParts(lastClosed)))
        .maybeSingle();
      openingBalance =
        previous?.closing_balance === undefined
          ? null
          : Number(previous.closing_balance);
      const change = previous
        ? closeAccountsChange(previous.bank_accounts, summed)
        : null;
      if (previous && openingBalance !== null && change) {
        const known = await getBankAccounts(userId, supabase);
        const ids = [...change.added, ...change.removed];
        const then = await readAccountBalances(
          userId,
          known.filter((account) => ids.includes(account.provider_account_id)),
          previous.observed_on,
          supabase,
        );
        const unread = ids.filter(
          (id) =>
            !then.per.some(
              (entry) => entry.accountId === id && entry.lookup.ok,
            ),
        );
        if (unread.length > 0) {
          outcome.blocked = {
            kind: "unreadable",
            accounts: unread.map(
              (id) =>
                known.find((account) => account.provider_account_id === id)
                  ?.label ?? id,
            ),
          };
          return outcome;
        }
        const heldThen = (id: string) => {
          const entry = then.per.find((each) => each.accountId === id);
          return entry?.lookup.ok ? entry.lookup.reading.amount : 0;
        };
        ownOpening =
          Math.round(
            (openingBalance +
              change.added.reduce((sum, id) => sum + heldThen(id), 0) -
              change.removed.reduce((sum, id) => sum + heldThen(id), 0)) *
              100,
          ) / 100;
        openingBalance = ownOpening;
      }
    } else {
      const priorKey = previousMonthKey(next.monthKey);
      const [priorYear, priorMonth] = monthKeyParts(priorKey);
      const opening = await readCashBalance(
        userId,
        lastDayIsoOfMonth(priorYear, priorMonth),
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
        observed_on: closesOn,
        balance_source: "bank",
        bank_accounts: summed,
        opening_balance: ownOpening,
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
