/**
 * The two dates a transaction can have.
 *
 * `occurred_on` is the day a row counts for, and every month view, budget,
 * summary and read uses it. `cash_on`, when set, is the day the money
 * actually moved — a salary paid on 22 September for October counts for
 * October and arrived on the 22nd (migration 045). Only what pairs the
 * ledger with a balance the bank reported cares about the second date: the
 * month close, the balance curve, the spending that went unrecorded. Those
 * read a row's date through `cashDateOf`, and fetch a month through
 * `budgetOrCashDateFilter` so a row moved out of the month is still found by
 * the day its money moved.
 */

export interface DatedRow {
  occurred_on: string;
  cash_on?: string | null;
}

/** The day the money moved: `cash_on` when set, otherwise `occurred_on`. */
export function cashDateOf(row: DatedRow): string {
  return row.cash_on ?? row.occurred_on;
}

/** Whether the money moved between `from` and `to`, both inclusive. */
export function movedBetween(row: DatedRow, from: string, to: string): boolean {
  const date = cashDateOf(row);
  return date >= from && date <= to;
}

/**
 * A PostgREST `or` filter for rows that count for, or whose money moved in,
 * a date range — the superset a cash calculation has to fetch before keeping
 * the rows `movedBetween` it.
 */
export function budgetOrCashDateFilter(from: string, to: string): string {
  return (
    `and(occurred_on.gte.${from},occurred_on.lte.${to}),` +
    `and(cash_on.gte.${from},cash_on.lte.${to})`
  );
}

/** Whether a row was moved to count for another day than its money moved. */
export function isMovedRow(row: DatedRow): boolean {
  return Boolean(row.cash_on) && row.cash_on !== row.occurred_on;
}

/**
 * Whether a row's money came into the account rather than left it, by the
 * month close's rule: income arrives, and so does a withdrawal from savings
 * (a savings category that does not count toward the summary). Decides
 * whether a moved row says "Reçu le" or "Payé le".
 */
export function bringsMoneyIn(category: {
  type: string;
  counts_toward_summary?: boolean | null;
}): boolean {
  return (
    category.type === "income" ||
    (category.type === "savings" && category.counts_toward_summary === false)
  );
}

/**
 * The rows whose money moved between `from` and `to`, out of rows fetched by
 * the day they count for plus the moved ones (`cash_on` in range): each
 * once, kept by the day its money moved. What the month close and the
 * balance curve read, since they pair the ledger with a balance the bank
 * reported on its own day.
 */
export function rowsByCashDate<Row extends DatedRow & { id: string }>(
  fetched: readonly Row[],
  moved: readonly Row[],
  from: string,
  to: string,
): Row[] {
  const byId = new Map(fetched.map((row) => [row.id, row] as const));
  for (const row of moved) {
    byId.set(row.id, row);
  }
  return [...byId.values()].filter((row) => movedBetween(row, from, to));
}
