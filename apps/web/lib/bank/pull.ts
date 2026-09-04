import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideBankPull,
  describePullAge,
  lastPullAt,
  pullIsStale,
  unattendedRemaining,
  type PullDecision,
  type PullFreshness,
  type PullKind,
  type PullRecord,
} from "@finance/core/bank-pull";
import { todayIsoLocal } from "@finance/core/constants";
import type { Database } from "@finance/core/types/database";
import { getBankConnection } from "@/lib/bank/client";

type Client = SupabaseClient<Database>;

/**
 * Asking the bank, as against reading the copy we keep of it.
 *
 * Everything else in `lib/bank` reads open-banking.io's stored statement.
 * That is a read of our own data: it reaches no bank, costs nothing, and can
 * be done as often as anyone likes — but it is only ever as current as
 * whatever the provider last fetched on its own schedule. Until this existed,
 * pressing "Sync" twice returned the same rows twice and there was no way for
 * the app to be more up to date than it already was.
 *
 * `syncAll` is the call that reaches the bank. It is the one thing here with
 * a real ceiling, and the ceiling is regulatory: PSD2 allows an account
 * information service four reads a day per account with nobody present, and
 * unlimited reads when the user is. So the decision of whether to make the
 * call lives in `@finance/core/bank-pull` where it is tested, this module is
 * the plumbing around it, and the two kinds of caller are named rather than
 * inferred — a run that guessed wrong would either waste the day's allowance
 * or exceed it.
 */

/**
 * Whether an error means "this feature's schema is not here yet".
 *
 * Same three codes as `queries/bank-balance`: PostgREST's missing table,
 * Postgres', and a missing column. Every other error still throws.
 */
function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

/**
 * How many days of tally to read.
 *
 * Two is the whole requirement: today's, for the allowance, and yesterday's,
 * because a pull at 23:59 and one at 00:01 are a minute apart on different
 * days and the cooldown has to see both.
 */
const RECORD_WINDOW = 2;

export interface PullState {
  records: PullRecord[];
  /** The newest pull of either kind, ISO, or null if the bank never answered. */
  lastPulledAt: string | null;
  /** What is left of today's unattended allowance. */
  unattendedLeft: number;
  /**
   * Whether the tally can be read and written at all.
   *
   * False means migration 022 has not run. That is not the same as "nothing
   * has been pulled yet", and conflating the two is how an unattended run
   * ends up uncapped: an empty tally allows four more pulls, and a store that
   * cannot be written never fills up, so every run would be allowed and none
   * would be counted.
   */
  tracked: boolean;
}

/**
 * The stored tally, or an empty untracked one.
 *
 * Migration 022 may not have run — the deployment works without it, exactly
 * as the balance feature works without 021 — and an optional feature's
 * missing table must not take down a screen people use every day.
 */
export async function readPullState(
  supabase: Client,
  userId: string,
): Promise<PullState> {
  const today = todayIsoLocal();
  const { data, error } = await supabase
    .from("bank_pulls")
    .select("pulled_on, unattended, attended, last_pulled_at")
    .eq("user_id", userId)
    .order("pulled_on", { ascending: false })
    .limit(RECORD_WINDOW);

  if (error) {
    if (isMissingSchema(error)) {
      return {
        records: [],
        lastPulledAt: null,
        unattendedLeft: 0,
        tracked: false,
      };
    }
    throw error;
  }

  const records: PullRecord[] = (data ?? []).map((row) => ({
    pulledOn: row.pulled_on,
    unattended: row.unattended,
    attended: row.attended,
    lastPulledAt: row.last_pulled_at,
  }));

  return {
    records,
    lastPulledAt: lastPullAt(records),
    unattendedLeft: unattendedRemaining(records, today),
    tracked: true,
  };
}

export async function readPullFreshness(
  supabase: Client,
  userId: string,
): Promise<PullFreshness> {
  const state = await readPullState(supabase, userId);
  const now = new Date().toISOString();

  return {
    age: describePullAge(state.lastPulledAt, now),
    lastPulledAt: state.lastPulledAt,
    // Only meaningful when the tally is readable. Untracked, the age is
    // unknown rather than infinite, and `known: false` is what says so.
    stale: state.tracked && pullIsStale(state.lastPulledAt, now),
    unattendedLeft: state.unattendedLeft,
    known: state.tracked,
  };
}

/**
 * Count a pull that has just been made.
 *
 * Through the database function rather than an upsert from here, so two
 * refreshes racing serialise on the row instead of each reading 2 and writing
 * 3. A failure to count is deliberately not fatal: the pull already happened,
 * and losing the tally is a worse outcome than the caller thinks it is but a
 * much better one than throwing away rows the bank has just given us.
 */
async function recordPull(
  supabase: Client,
  userId: string,
  kind: PullKind,
): Promise<void> {
  const { error } = await supabase.rpc("record_bank_pull", {
    target_user: userId,
    was_attended: kind === "attended",
    today: todayIsoLocal(),
  });

  if (error && !isMissingSchema(error) && error.code !== "42883") {
    // 42883 is "no such function", the migration-not-run case for an RPC.
    throw error;
  }
}

export type PullOutcome =
  | {
      pulled: true;
      /** Accounts the provider reached. */
      accounts: number;
      /** Rows the bank had that the provider did not already hold. */
      newTransactions: number;
    }
  /** Nothing was asked, and this is the reason in words a screen can show. */
  | { pulled: false; why: string };

/** Why a refusal happened, in words a screen can show. */
function explain(decision: Exclude<PullDecision, { pull: true }>): string {
  switch (decision.reason) {
    case "cooling-down":
      return `Your bank was asked moments ago — try again in ${decision.retryAfterSeconds}s.`;
    case "allowance-spent":
      return `Today's ${decision.allowance} unattended checks are used up. Pressing refresh yourself still works.`;
    case "nothing-to-pull":
      return "No connected account can be read right now.";
  }
}

/**
 * Ask the bank for anything new, if the allowance and the cooldown permit.
 *
 * Returns rather than throws on a refusal, and on a provider failure too. The
 * statement we already hold is still perfectly readable, so a pull that could
 * not happen means the caller carries on and reads the stored copy — which is
 * what it did before this existed. The only thing lost is freshness, and the
 * interface says how fresh the figures are either way.
 */
export async function pullFromBank(
  supabase: Client,
  userId: string,
  kind: PullKind,
): Promise<PullOutcome> {
  const connection = getBankConnection(userId);
  if (!connection) {
    return { pulled: false, why: "No bank is connected to this account." };
  }

  let pullable = 0;
  try {
    const accounts = await connection.client.getAccounts();
    // A lapsed consent cannot be pulled at all, and `syncAll` skips it. Asking
    // when every account is lapsed would spend an attempt on a call that
    // cannot answer.
    pullable = accounts.filter((account) => !account.needsReconnect).length;
  } catch (error) {
    return {
      pulled: false,
      why: error instanceof Error ? error.message : "Could not reach the bank.",
    };
  }

  const state = await readPullState(supabase, userId);

  // An unattended pull that cannot be counted must not happen. The allowance
  // is the whole reason the tally exists, and a store that cannot be written
  // never fills up — so every scheduled run would be permitted and none
  // recorded, which is precisely the state the allowance guards against.
  // Attended access has no allowance to exceed, so it is unaffected.
  if (kind === "unattended" && !state.tracked) {
    return {
      pulled: false,
      why: "Pull tracking is not set up (migration 022), so unattended checks are held back.",
    };
  }

  const decision = decideBankPull({
    kind,
    records: state.records,
    today: todayIsoLocal(),
    now: new Date().toISOString(),
    pullableAccounts: pullable,
  });

  if (!decision.pull) {
    return { pulled: false, why: explain(decision) };
  }

  try {
    const result = await connection.client.syncAll();
    // Counted only once the provider has answered. Counting first would spend
    // the day's allowance on calls that never reached a bank, which is the
    // opposite of what the allowance protects.
    await recordPull(supabase, userId, kind);
    return {
      pulled: true,
      accounts: result.accounts,
      newTransactions: result.newTransactions,
    };
  } catch (error) {
    // A bank that will not answer today is an ordinary outcome. Not counted:
    // nothing was read, so nothing was spent.
    return {
      pulled: false,
      why:
        error instanceof Error
          ? error.message
          : "Your bank did not answer just now.",
    };
  }
}
