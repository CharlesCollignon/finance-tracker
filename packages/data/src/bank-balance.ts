import {
  cashBalanceAsOf,
  type AccountRows,
  type CashBalance,
} from "@finance/core/bank-balance";
import type { BankAccount } from "@finance/core/types/database";

import type { Db } from "./client";
import { isMissingSchema } from "./schema";

/** Every account the connection has ever shown, ticked or not. */
export async function getBankAccounts(
  db: Db,
  userId: string,
): Promise<BankAccount[]> {
  const { data, error } = await db
    .from("bank_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("label");

  // Before migration 021 this table does not exist, and reading balances is
  // an enhancement to a screen that has to work without it. A surface people
  // use every day must not fall over because an optional feature's migration
  // has not been run yet.
  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as BankAccount[];
}

/**
 * What the counted accounts held at the end of a given day.
 *
 * Reads the stored statement rather than the bank: the figure a close was
 * based on should not change afterwards, the provider's window is finite,
 * and the phone holds no credentials and cannot reach the provider at all.
 *
 * Null when the feature is not set up — no connection, or nobody has said
 * which accounts hold spendable money. That is different from a reading that
 * failed, which comes back as a CashBalance with `ok: false` and the accounts
 * it could not read.
 */
export async function readCashBalance(
  db: Db,
  userId: string,
  date: string,
): Promise<CashBalance | null> {
  const accounts = await getBankAccounts(db, userId);
  const counted = accounts.filter((account) => account.counts_as_cash);

  if (counted.length === 0) {
    return null;
  }

  const { data, error } = await db
    .from("bank_feed_items")
    .select("provider_account_id, occurred_on, balance_after, intraday_index")
    .eq("user_id", userId)
    .in(
      "provider_account_id",
      counted.map((account) => account.provider_account_id),
    )
    .lte("occurred_on", date)
    // Newest first and capped: only the last row of the last day is needed,
    // and one page of it is far more than enough to find that row for every
    // account. Ordering by intraday_index second keeps the day's last
    // movement ahead of the ones before it.
    .order("occurred_on", { ascending: false })
    .order("intraday_index", { ascending: true })
    .limit(400);

  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }

  const byAccount = new Map<string, AccountRows>();
  for (const account of counted) {
    byAccount.set(account.provider_account_id, {
      accountId: account.provider_account_id,
      label: account.label,
      rows: [],
    });
  }

  for (const row of data ?? []) {
    byAccount.get(row.provider_account_id)?.rows.push({
      occurredOn: row.occurred_on,
      balanceAfter:
        row.balance_after === null ? null : Number(row.balance_after),
      intradayIndex: row.intraday_index,
    });
  }

  // A lapsed consent stores no rows, so it arrives here with an empty list
  // and is reported as unreadable rather than as an empty account.
  return cashBalanceAsOf([...byAccount.values()], date);
}
