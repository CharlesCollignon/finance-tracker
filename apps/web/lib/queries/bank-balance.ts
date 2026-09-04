import {
  balanceAsOf,
  cashBalanceAsOf,
  type AccountRows,
  type CashBalance,
} from "@finance/core/bank-balance";
import type { BankAccount, Database } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/**
 * Whether an error means "this feature's schema is not here yet".
 *
 * PGRST205 is PostgREST's missing table, 42P01 is Postgres', and 42703 is a
 * missing column. Every other error still throws: swallowing them all would
 * turn a permissions mistake or a broken query into a screen that quietly
 * shows nothing, which is how a wrong balance gets believed.
 */
function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

/** Every account the connection has ever shown, ticked or not. */
export async function getBankAccounts(
  userId: string,
  client?: Client,
): Promise<BankAccount[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
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
 * based on should not change afterwards, the provider's window is finite, and
 * this has to work from a phone with no bank round trip.
 *
 * Null when the feature is not set up — no connection, or nobody has said
 * which accounts hold spendable money. That is different from a reading that
 * failed, which comes back as a CashBalance with `ok: false` and the accounts
 * it could not read.
 */
export async function readCashBalance(
  userId: string,
  date: string,
  client?: Client,
): Promise<CashBalance | null> {
  const supabase = client ?? (await createClient());
  const accounts = await getBankAccounts(userId, supabase);
  const counted = accounts.filter((account) => account.counts_as_cash);

  if (counted.length === 0) {
    return null;
  }

  const { data, error } = await supabase
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

export { balanceAsOf };
