import { firstIssue, type ActionResult } from "@finance/core/action-result";
import { balanceReadingSchema } from "@finance/core/validations/month-close";

import type { Db } from "./client";
import { dbError } from "./errors";
import { isMissingSchema } from "./schema";

/**
 * A balance the user typed on Le point before any close (migration 057).
 *
 * A reading like a close: the rows recorded after it move it, and the first
 * close newer than it takes over (`readMonthBalance`). One per user, the
 * last typed.
 */
export interface BalanceReading {
  readOn: string;
  amount: number;
}

/** The balance typed last, or null — also where migration 057 is not run. */
export async function getBalanceReading(
  db: Db,
  userId: string,
): Promise<BalanceReading | null> {
  const { data, error } = await db
    .from("balance_readings")
    .select("read_on, amount")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }
  return data ? { readOn: data.read_on, amount: Number(data.amount) } : null;
}

/** Record what the account holds today, replacing any balance typed before. */
export async function saveBalanceReading(
  db: Db,
  userId: string,
  { amount, today }: { amount: number; today: string },
): Promise<ActionResult> {
  const parsed = balanceReadingSchema.safeParse({ amount });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const { error } = await db.from("balance_readings").upsert(
    {
      user_id: userId,
      read_on: today,
      amount: parsed.data.amount,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  return error
    ? { error: dbError(error) }
    : { success: true, message: "actions.balanceSet" };
}
