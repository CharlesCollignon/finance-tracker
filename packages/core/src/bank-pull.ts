/**
 * Whether the bank itself may be asked right now.
 *
 * Two quite different calls hide behind the word "sync". Reading
 * open-banking.io's stored statement is a read of our own copy: it costs
 * nothing, reaches no bank, and may be done as often as anyone likes. Asking
 * the provider to go and fetch from the bank — the SDK's `syncAll` — is the
 * only call here with a ceiling, and the ceiling is regulatory: under PSD2 an
 * account information service may read an account four times a day when the
 * user is not present, and without limit when they are.
 *
 * That distinction is the whole of this module. An attended pull is somebody
 * pressing refresh, and the only thing standing in its way is a short
 * cooldown so a double-tap does not become two round trips. An unattended
 * pull is the cron, and it spends from a daily allowance that has to be
 * counted somewhere durable, because a serverless function remembers nothing
 * between invocations.
 *
 * Kept free of database and SDK concerns so the arithmetic — which is the
 * part that must not be wrong — is testable on its own.
 */

/** Who is asking, which is what decides which limit applies. */
export type PullKind = "attended" | "unattended";

/**
 * How many unattended reads a day PSD2 allows without the user present.
 *
 * The figure is the regulation's, not a preference: article 36(5)(b) of the
 * RTS on strong customer authentication. Deliberately named rather than
 * inlined, so the reason it is four is findable from the call site.
 */
export const PSD2_UNATTENDED_READS_PER_DAY = 4;

/**
 * How long after any pull an attended one waits.
 *
 * Not a regulatory limit — attended access has none — but pressing refresh
 * twice in the same breath should not become two round trips to a bank, and a
 * bank that has just answered has nothing new to say. Short enough that it
 * never reads as the button being broken.
 */
export const ATTENDED_COOLDOWN_SECONDS = 90;

export interface PullBudget {
  unattendedPerDay: number;
  attendedCooldownSeconds: number;
}

export const DEFAULT_PULL_BUDGET: PullBudget = {
  unattendedPerDay: PSD2_UNATTENDED_READS_PER_DAY,
  attendedCooldownSeconds: ATTENDED_COOLDOWN_SECONDS,
};

/** One day's pull tally, as the store holds it. */
export interface PullRecord {
  /** YYYY-MM-DD, the local day the counters belong to. */
  pulledOn: string;
  unattended: number;
  attended: number;
  /** ISO instant of the most recent pull of either kind that day. */
  lastPulledAt: string;
}

export type PullRefusal =
  /** A pull happened moments ago; the bank has nothing newer to say yet. */
  | { reason: "cooling-down"; retryAfterSeconds: number }
  /** The day's unattended allowance is spent. Tomorrow's run is fine. */
  | { reason: "allowance-spent"; used: number; allowance: number }
  /**
   * Nothing to ask. No connection configured, or no account with a live
   * consent — a lapsed one cannot be pulled at all, so spending an attempt on
   * it would only burn the allowance.
   */
  | { reason: "nothing-to-pull" };

export type PullDecision = { pull: true } | ({ pull: false } & PullRefusal);

function secondsBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return Number.POSITIVE_INFINITY;
  }
  return (to - from) / 1000;
}

/**
 * The most recent pull across the records given, whichever day it is on.
 *
 * The cooldown has to see across midnight: a pull at 23:59 and one at 00:01
 * are two minutes apart and land on different days, so reading only today's
 * row would let the second straight through.
 */
export function lastPullAt(records: readonly PullRecord[]): string | null {
  let newest: string | null = null;
  for (const record of records) {
    if (newest === null || record.lastPulledAt > newest) {
      newest = record.lastPulledAt;
    }
  }
  return newest;
}

/** How much of today's unattended allowance is already spent. */
export function unattendedUsedOn(
  records: readonly PullRecord[],
  today: string,
): number {
  return records
    .filter((record) => record.pulledOn === today)
    .reduce((sum, record) => sum + record.unattended, 0);
}

export interface PullQuestion {
  kind: PullKind;
  /** Every stored day within reach; only today's and the newest matter. */
  records: readonly PullRecord[];
  /** The local day, as `todayIsoLocal` gives it. */
  today: string;
  /** The instant being asked about, ISO. */
  now: string;
  /** Accounts with a live consent. Zero means there is nothing to ask for. */
  pullableAccounts: number;
  budget?: PullBudget;
}

/**
 * Say whether to reach for the bank, and if not, why not.
 *
 * A refusal is an ordinary answer rather than an error: the statement we
 * already hold is still readable, and the caller's next move is to read it
 * and say how old it is. Nothing here throws.
 */
export function decideBankPull({
  kind,
  records,
  today,
  now,
  pullableAccounts,
  budget = DEFAULT_PULL_BUDGET,
}: PullQuestion): PullDecision {
  if (pullableAccounts <= 0) {
    return { pull: false, reason: "nothing-to-pull" };
  }

  // The allowance is checked before the cooldown, because "come back
  // tomorrow" is the more useful thing to hear when both are true.
  if (kind === "unattended") {
    const used = unattendedUsedOn(records, today);
    if (used >= budget.unattendedPerDay) {
      return {
        pull: false,
        reason: "allowance-spent",
        used,
        allowance: budget.unattendedPerDay,
      };
    }
  }

  const last = lastPullAt(records);
  if (last !== null) {
    const elapsed = secondsBetween(last, now);
    // A clock that has gone backwards — a replayed request, a machine whose
    // time was corrected — reads as a negative gap. Treated as "just now"
    // rather than as a very long wait, so the cooldown cannot be skipped by
    // being wrong about the time.
    if (elapsed < budget.attendedCooldownSeconds) {
      return {
        pull: false,
        reason: "cooling-down",
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(budget.attendedCooldownSeconds - Math.max(0, elapsed)),
        ),
      };
    }
  }

  return { pull: true };
}

/** What is left of today's unattended allowance. */
export function unattendedRemaining(
  records: readonly PullRecord[],
  today: string,
  budget: PullBudget = DEFAULT_PULL_BUDGET,
): number {
  return Math.max(
    0,
    budget.unattendedPerDay - unattendedUsedOn(records, today),
  );
}

/* ------------------------------------------------------------ freshness */

/**
 * How old the figures on screen are, in words.
 *
 * Written out rather than handed to `Intl.RelativeTimeFormat`, for the same
 * reason the month names in `constants` are: the exact strings are part of
 * the interface, and a formatter that renders "1 minute ago" on one runtime
 * and "1 min. ago" on another makes the shell flicker between them.
 *
 * "Just now" covers everything under a minute. A refresh that reports "0
 * minutes ago" invites the reader to wonder whether it worked.
 */
export function describePullAge(
  lastPulledAt: string | null,
  now: string,
): string {
  if (lastPulledAt === null) {
    return "never";
  }

  const seconds = secondsBetween(lastPulledAt, now);
  if (!Number.isFinite(seconds)) {
    return "never";
  }
  if (seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * Whether what is on screen is old enough to be worth saying so about.
 *
 * The shell shows the age of the data at all times, but only draws attention
 * to it once it is old enough that a figure could have moved — otherwise the
 * indicator is a permanent nag about a state that is entirely normal.
 */
export const STALE_AFTER_SECONDS = 6 * 60 * 60;

export function pullIsStale(
  lastPulledAt: string | null,
  now: string,
  staleAfterSeconds: number = STALE_AFTER_SECONDS,
): boolean {
  if (lastPulledAt === null) {
    return true;
  }
  const seconds = secondsBetween(lastPulledAt, now);
  return !Number.isFinite(seconds) || seconds >= staleAfterSeconds;
}

/**
 * How old what is on screen is, as a control needs it.
 *
 * Declared here rather than beside the query that builds it so a client
 * component can name the type without importing a module that reaches the
 * provider SDK, and so both apps describe freshness the same way.
 */
export interface PullFreshness {
  /** "just now", "20 min ago", "yesterday", "never". */
  age: string;
  lastPulledAt: string | null;
  stale: boolean;
  /** What is left of today's unattended allowance. */
  unattendedLeft: number;
  /**
   * Whether the age above means anything.
   *
   * False when the tally store is not there (migration 022 has not run). Not
   * the same as "nothing has been pulled yet", and a control must not confuse
   * the two: an unknown age rendered as "never", with the attention dot lit,
   * is a permanent claim that the figures are stale — which is exactly the
   * false nag the staleness threshold exists to avoid.
   */
  known: boolean;
}
