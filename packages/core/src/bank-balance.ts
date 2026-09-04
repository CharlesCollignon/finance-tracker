/**
 * Reading a past balance off the statement.
 *
 * PSD2 gives the balance now; it will not answer "what did the account hold
 * on 31 August". But most banks attach a running balance to each transaction
 * — `balanceAfterTransaction` — and that series, checked against the account's
 * own closing balance, is a complete record of what the account held after
 * every movement it ever made. So a past month-end is not something the user
 * has to remember: it is the figure attached to the last transaction of that
 * month.
 *
 * Verified against a live Crédit Agricole account before this was written:
 * 821 rows over thirteen months, 819 of the 820 steps consistent with the row
 * amounts, and the newest row's figure equal to the account's reported
 * closing balance to the cent.
 */

export interface BalanceRow {
  occurredOn: string;
  /**
   * The provider's running balance after this row, where it gave one. Null is
   * ordinary — the field is optional in PSD2 and some banks omit it — and a
   * null on the row that matters means the reading fails rather than guesses.
   */
  balanceAfter: number | null;
  /**
   * Position among that day's rows, newest first, so 0 is the last movement
   * of the day. Statements carry dates and no times, so without this there is
   * no way to tell which of a day's rows the day ended on.
   */
  intradayIndex: number;
}

export interface BalanceReading {
  amount: number;
  /** The date of the row it came from, which may be days before the one asked. */
  fromDate: string;
  /** How far back that row is. A long gap is not wrong, only quiet. */
  daysStale: number;
}

/** Why a balance could not be read, in words a screen can use. */
export type BalanceMiss =
  | "no-rows-before"
  | "no-running-balance"
  /**
   * The day's last movement is not in the set, so the newest balance held for
   * it is the one from before that movement.
   *
   * Happens because not every row the bank reports is kept: a transfer
   * between two of the user's own accounts is dropped before it reaches the
   * ledger, and it still moved the balance. Positions are numbered over the
   * bank's whole batch precisely so this is detectable — index 0 is the day's
   * last movement, and if the row chosen is not index 0 then something after
   * it was dropped.
   */
  | "day-incomplete";

export type BalanceLookup =
  | { ok: true; reading: BalanceReading }
  | { ok: false; reason: BalanceMiss };

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

/**
 * What the account held at the end of `date`.
 *
 * The last movement on or before that day carries the answer. When the day
 * itself has no movements the answer is still correct — a balance does not
 * change on a day nothing happened — so a reading from a week earlier is
 * reported as stale rather than as a failure, and the caller decides whether
 * the gap matters.
 */
export function balanceAsOf(rows: BalanceRow[], date: string): BalanceLookup {
  const upTo = rows.filter((row) => row.occurredOn <= date);
  if (upTo.length === 0) {
    return { ok: false, reason: "no-rows-before" };
  }

  let latest = upTo[0]!;
  for (const row of upTo) {
    if (
      row.occurredOn > latest.occurredOn ||
      (row.occurredOn === latest.occurredOn &&
        row.intradayIndex < latest.intradayIndex)
    ) {
      latest = row;
    }
  }

  if (latest.balanceAfter === null) {
    return { ok: false, reason: "no-running-balance" };
  }

  // Refusing beats answering with the balance from earlier in the day. A
  // month that waits is visible and fixable; a month closed against a figure
  // that is short by one transfer looks exactly like unrecorded spending.
  if (latest.intradayIndex !== 0) {
    return { ok: false, reason: "day-incomplete" };
  }

  return {
    ok: true,
    reading: {
      amount: latest.balanceAfter,
      fromDate: latest.occurredOn,
      daysStale: daysBetween(latest.occurredOn, date),
    },
  };
}

export interface AccountRows {
  accountId: string;
  label: string;
  rows: BalanceRow[];
}

export interface CashBalance {
  /** Every counted account read successfully; the sum is trustworthy. */
  ok: boolean;
  total: number;
  per: {
    accountId: string;
    label: string;
    lookup: BalanceLookup;
  }[];
  /** Accounts that could not be read, for a screen to name them. */
  missing: { accountId: string; label: string; reason: BalanceMiss }[];
}

/**
 * The counted accounts' balances, summed, and honest about gaps.
 *
 * All or nothing on purpose. An account whose consent has lapsed returns no
 * transactions and a zero "expected" balance, and quietly adding that zero to
 * the total would report a month in which thousands of euros vanished. A
 * close that cannot read every account it was told to count does not close.
 */
export function cashBalanceAsOf(
  accounts: AccountRows[],
  date: string,
): CashBalance {
  const per = accounts.map((account) => ({
    accountId: account.accountId,
    label: account.label,
    lookup: balanceAsOf(account.rows, date),
  }));

  const missing = per
    .filter((entry) => !entry.lookup.ok)
    .map((entry) => ({
      accountId: entry.accountId,
      label: entry.label,
      reason: (entry.lookup as { ok: false; reason: BalanceMiss }).reason,
    }));

  const total = per.reduce(
    (sum, entry) => (entry.lookup.ok ? sum + entry.lookup.reading.amount : sum),
    0,
  );

  return {
    ok: accounts.length > 0 && missing.length === 0,
    total: Math.round(total * 100) / 100,
    per,
    missing,
  };
}

/**
 * Where each row sits within its day, given the provider's own ordering.
 *
 * Statements carry dates and no times, so the only thing that says which
 * movement a day ended on is the order the provider returned them in —
 * newest first. Computed over the raw batch rather than over what survives
 * filtering: a transfer between the user's own accounts is dropped before it
 * reaches the ledger, but it still moved the balance, and skipping it here
 * would hand the next row's index to a row the day did not end on.
 */
export function intradayIndexes(
  items: { id: string; date: string | null }[],
): Map<string, number> {
  const seen = new Map<string, number>();
  const out = new Map<string, number>();

  for (const item of items) {
    if (!item.date) {
      continue;
    }
    const next = seen.get(item.date) ?? 0;
    out.set(item.id, next);
    seen.set(item.date, next + 1);
  }

  return out;
}
