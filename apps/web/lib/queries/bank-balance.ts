import { balanceAsOf, type CashBalance } from "@finance/core/bank-balance";
import type { BankAccount, Database } from "@finance/core/types/database";
import * as bankBalance from "@finance/data/bank-balance";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The bank's balances, read from the stored statement — the shared reads in
 * `@finance/data/bank-balance`, with this request's client unless a caller
 * running without a session (a cron) hands over its own.
 */

type Client = SupabaseClient<Database>;

/** Every account the connection has ever shown, ticked or not. */
export async function getBankAccounts(
  userId: string,
  client?: Client,
): Promise<BankAccount[]> {
  return bankBalance.getBankAccounts(client ?? (await createClient()), userId);
}

/** What the counted accounts held at the end of a given day. */
export async function readCashBalance(
  userId: string,
  date: string,
  client?: Client,
): Promise<CashBalance | null> {
  return bankBalance.readCashBalance(
    client ?? (await createClient()),
    userId,
    date,
  );
}

export { balanceAsOf };
