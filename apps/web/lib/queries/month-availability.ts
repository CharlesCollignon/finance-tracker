import { createClient } from "@/lib/supabase/server";

/**
 * Which months of a year are worth opening.
 *
 * The month grid would otherwise be twelve identical buttons, three quarters
 * of them leading to an empty screen — and the two facts that make one month
 * different from another are already in the database: whether anything was
 * recorded in it, and whether it has been closed. A grid that says so turns
 * "hunt for the month I was looking at" into "the one with a dot on it".
 */
export interface MonthAvailability {
  year: number;
  /** Months (1-12) with at least one transaction. */
  withData: number[];
  /** Months (1-12) that have been closed against a balance. */
  closed: number[];
}

export async function getMonthAvailability(
  userId: string,
  year: number,
): Promise<MonthAvailability> {
  const supabase = await createClient();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [
    { data: transactions, error: txError },
    { data: closes, error: closeError },
  ] = await Promise.all([
    // Only the date column. A year of a busy ledger is a couple of thousand
    // dates, which is a small payload and cheaper than twelve counts.
    supabase
      .from("transactions")
      .select("occurred_on")
      .eq("user_id", userId)
      .gte("occurred_on", start)
      .lte("occurred_on", end),
    supabase
      .from("month_closes")
      .select("month")
      .eq("user_id", userId)
      .gte("month", start)
      .lte("month", end),
  ]);

  if (txError) {
    throw txError;
  }
  if (closeError) {
    throw closeError;
  }

  const withData = new Set<number>();
  for (const row of transactions ?? []) {
    withData.add(Number((row.occurred_on as string).slice(5, 7)));
  }

  const closed = new Set<number>();
  for (const row of closes ?? []) {
    closed.add(Number((row.month as string).slice(5, 7)));
  }

  return {
    year,
    withData: [...withData].sort((a, b) => a - b),
    closed: [...closed].sort((a, b) => a - b),
  };
}
