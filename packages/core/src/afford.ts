import type { LeftToSpend } from "./left-to-spend";

/**
 * « Puis-je me permettre ? » — what a purchase would leave, worked out from
 * figures already on Le point and saved nowhere.
 *
 * Facts, never a verdict: what « Il vous reste » would become, where the
 * account's lowest point ahead would land, and — for something paid every
 * month — what each month would leave. Whether to buy it is the reader's.
 */
export type AffordCadence = "once" | "monthly";

export interface AffordAnswer {
  /** « Il vous reste » once it is paid; below zero, what would be missing. */
  leftAfter: number;
  /** The lowest the account goes ahead, once it is paid. */
  lowestAfter: { date: string; value: number } | null;
  /** What each month would leave, for a monthly one with an income set. */
  eachMonthAfter: number | null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function affordAnswer({
  left,
  lowest,
  eachMonth,
  amount,
  cadence,
}: {
  left: Pick<LeftToSpend, "amount">;
  /** The balance's lowest point from today, as Le point's line has it. */
  lowest: { date: string; value: number } | null;
  /** « Reste chaque mois » (`rollUpRecurring`'s `left`), null without income. */
  eachMonth: number | null;
  amount: number;
  cadence: AffordCadence;
}): AffordAnswer {
  return {
    leftAfter: roundMoney(left.amount - amount),
    lowestAfter: lowest
      ? { date: lowest.date, value: roundMoney(lowest.value - amount) }
      : null,
    eachMonthAfter:
      cadence === "monthly" && eachMonth !== null
        ? roundMoney(eachMonth - amount)
        : null,
  };
}
