/**
 * What the account holds through one month, day by day.
 *
 * The Bearing leads with two figures — what is on the account and what the
 * month ends at — and draws the line between them. Both figures and the line
 * come out of here, so the curve can never end somewhere its caption does
 * not.
 *
 * The balance is only ever pinned to one thing the app has read rather than
 * summed: an anchor. With a bank that is the statement's balance on a day;
 * without one it is the balance the last month close recorded. Every other
 * day is that anchor moved by the movements between the two — recorded ones
 * for what has happened, planned ones for what the charges still call for.
 * Without an anchor there is no balance to show, and the curve says so by
 * starting at zero and counting the month's net instead. A balance invented
 * to fill the gap would be the one figure on the screen nobody could check.
 *
 * Kept free of database concerns so the arithmetic is testable on its own.
 */

import { getMonthBounds, shiftIsoDate } from "./constants";
import type { UpcomingCharge } from "./still-to-come";
import type { TransactionWithCategory } from "./types/database";
import { cashDateOf } from "./cash-date";

/** Sub-cent differences are rounding, not findings. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A balance the app read rather than worked out: what was held at the end of a day. */
export interface BalanceAnchor {
  onDate: string;
  balance: number;
}

/** One movement's effect on the account, dated. */
export interface DatedDelta {
  date: string;
  delta: number;
}

/**
 * What one recorded transaction did to the account, by the month close's own
 * rule — see `buildRecordedCashFlows`. Income arrives; spending, saving and
 * transfers to a broker leave; a savings withdrawal comes back; a purchase
 * inside a wallet moves nothing, because its money left when it was
 * transferred in.
 */
export function transactionDelta(tx: TransactionWithCategory): number {
  const amount = Number(tx.amount);
  switch (tx.categories.type) {
    case "income":
      return amount;
    case "investment":
      return tx.categories.counts_toward_summary === false ? 0 : -amount;
    case "savings":
      return tx.categories.counts_toward_summary === false ? amount : -amount;
    default:
      return -amount;
  }
}

/**
 * What has happened, as movements on the account.
 *
 * Against a balance the bank reported (`anchored`), a row goes on the day its
 * money moved — an October salary paid on 22 September lifted the account on
 * the 22nd, and the curve has to rise there or every day before it is off by
 * a month's pay. `moved` brings in the rows whose money moved in the range
 * but that count for a day outside it, which a fetch by `occurred_on` cannot
 * see. Without an anchor the curve is the month's own net, which is a budget
 * and goes by the day each row counts for, so the October salary lifts
 * October.
 */
export function recordedDeltas(
  rows: readonly TransactionWithCategory[],
  {
    from,
    today,
    anchored,
    moved = [],
  }: {
    from: string;
    today: string;
    anchored: boolean;
    moved?: readonly TransactionWithCategory[];
  },
): DatedDelta[] {
  const byId = new Map(rows.map((row) => [row.id, row] as const));
  if (anchored) {
    for (const row of moved) {
      byId.set(row.id, row);
    }
  }
  const dateOf = anchored
    ? cashDateOf
    : (row: TransactionWithCategory) => row.occurred_on;
  return [...byId.values()]
    .filter((row) => dateOf(row) >= from && dateOf(row) <= today)
    .map((row) => ({ date: dateOf(row), delta: transactionDelta(row) }));
}

/**
 * What one charge still to come will do, by the still-to-come rule the month
 * pulse already uses: what arrives is income, and everything else leaves.
 */
export function upcomingDelta(charge: UpcomingCharge): number {
  return charge.type === "income" ? charge.amount : -charge.amount;
}

export type MonthPeriod = "past" | "current" | "future";

export interface MonthBalanceInput {
  year: number;
  month: number;
  today: string;
  /** Null when no balance has ever been read: the curve counts net instead. */
  anchor: BalanceAnchor | null;
  /**
   * What has happened, dated today or earlier. Every movement between the
   * anchor and the month it is carried to has to be here, or the balance
   * drifts by what is missing.
   */
  recorded: readonly DatedDelta[];
  /** What the charges still call for, dated after today. */
  planned: readonly DatedDelta[];
}

export interface MonthBalancePoint {
  date: string;
  value: number;
  /** After today: arithmetic on charges, not a balance anyone read. */
  planned: boolean;
}

export interface MonthBalance {
  period: MonthPeriod;
  /** `balance` when anchored; `net` counts the month from zero. */
  basis: "balance" | "net";
  /** What the account held as the month began. Zero on a net basis. */
  start: number;
  /** Today's figure — the month in progress only. */
  today: number | null;
  /** What the month ends at: recorded for a past month, planned otherwise. */
  end: number;
  /** One per day of the month. */
  points: MonthBalancePoint[];
  /**
   * The lowest the month goes from here on — from today in the month in
   * progress, across the whole month otherwise. The day money is tightest is
   * worth more than any average, and it is the one thing a line drawn to the
   * month's end can hide behind a figure that looks fine.
   */
  lowest: { date: string; value: number } | null;
}

/** Every day of a month, as ISO dates. */
function daysOf(year: number, month: number): string[] {
  const { start, end } = getMonthBounds(year, month);
  const days: string[] = [];
  for (let day = start; day <= end; day = shiftIsoDate(day, 1)) {
    days.push(day);
  }
  return days;
}

export function buildMonthBalance(input: MonthBalanceInput): MonthBalance {
  const { year, month, today, anchor } = input;
  const days = daysOf(year, month);
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const period: MonthPeriod =
    last < today ? "past" : first > today ? "future" : "current";

  const moves = [...input.recorded, ...input.planned];

  // The balance at the end of a day, from the anchor: forward by what came
  // after it, back by what came after the day asked about.
  const origin = anchor ?? { onDate: shiftIsoDate(first, -1), balance: 0 };
  function at(date: string): number {
    let value = origin.balance;
    for (const move of moves) {
      if (
        date > origin.onDate &&
        move.date > origin.onDate &&
        move.date <= date
      ) {
        value += move.delta;
      } else if (
        date < origin.onDate &&
        move.date > date &&
        move.date <= origin.onDate
      ) {
        value -= move.delta;
      }
    }
    return roundMoney(value);
  }

  const points = days.map((date) => ({
    date,
    value: at(date),
    planned: date > today,
  }));

  const from = period === "current" ? today : first;
  let lowest: MonthBalance["lowest"] = null;
  for (const point of points) {
    if (point.date < from) {
      continue;
    }
    if (lowest === null || point.value < lowest.value) {
      lowest = { date: point.date, value: point.value };
    }
  }

  return {
    period,
    basis: anchor ? "balance" : "net",
    start: at(shiftIsoDate(first, -1)),
    today: period === "current" ? at(today) : null,
    end: at(last),
    points,
    lowest,
  };
}

/** Sums of a month's recorded expenses, by `YYYY-MM`, for months asked about. */
export function spendingByMonth(
  transactions: readonly TransactionWithCategory[],
  monthKeys: readonly string[],
): Map<string, number> {
  const totals = new Map(monthKeys.map((key) => [key, 0]));
  for (const tx of transactions) {
    if (tx.categories.type !== "expense") {
      continue;
    }
    const key = tx.occurred_on.slice(0, 7);
    if (totals.has(key)) {
      totals.set(key, roundMoney(totals.get(key)! + Number(tx.amount)));
    }
  }
  return totals;
}

export interface CategorySpend {
  categoryId: string;
  name: string;
  icon: string | null;
  total: number;
}

/**
 * Where a month's spending went, largest first: the top few categories, and
 * the rest folded into one line so the list stays short enough to read.
 */
export function topSpending(
  transactions: readonly TransactionWithCategory[],
  keep = 4,
): { top: CategorySpend[]; rest: number; total: number } {
  const byCategory = new Map<string, CategorySpend>();
  let total = 0;
  for (const tx of transactions) {
    if (tx.categories.type !== "expense") {
      continue;
    }
    const amount = Number(tx.amount);
    total += amount;
    const entry = byCategory.get(tx.category_id) ?? {
      categoryId: tx.category_id,
      name: tx.categories.name,
      icon: tx.categories.icon,
      total: 0,
    };
    entry.total = roundMoney(entry.total + amount);
    byCategory.set(tx.category_id, entry);
  }

  const sorted = [...byCategory.values()].sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, keep);
  const rest = roundMoney(
    sorted.slice(keep).reduce((sum, entry) => sum + entry.total, 0),
  );
  return { top, rest, total: roundMoney(total) };
}
