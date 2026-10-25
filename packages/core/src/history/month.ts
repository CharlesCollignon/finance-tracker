/** A calendar month, `YYYY-MM`: the step every history series moves by. */
export type HistoryMonth = string;

/** Months from `from` to `to`: 0 for the same month, negative if earlier. */
export function monthsBetween(from: HistoryMonth, to: HistoryMonth): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** The month `count` months after `month`. */
export function addMonths(month: HistoryMonth, count: number): HistoryMonth {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + count;
  const year = Math.floor(index / 12);
  return `${year}-${String((index % 12) + 1).padStart(2, "0")}`;
}
