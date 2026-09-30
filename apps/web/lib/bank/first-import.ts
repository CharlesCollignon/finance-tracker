import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";
import { autoCloseMonths } from "@/lib/bank/auto-close";
import { getBankConnection } from "@/lib/bank/client";
import { noteSyncFailure, noteSyncHealthy } from "@/lib/bank/health-note";
import { syncBankFeed } from "@/lib/bank/sync";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The first import of a whole history, one account per request.
 *
 * Shared by the web's server actions and the phone's `/api/bank/import`
 * routes, which differ only in how they know who is asking. Every failure
 * comes back as `noteSyncFailure`'s sentence — recorded on the connection,
 * and never the provider's own error text, which is not for a screen.
 */

type Client = SupabaseClient<Database>;

type Result<T = object> = ({ error?: undefined } & T) | { error: string };

/**
 * The accounts a first import walks, one per request — see `accountIds` in
 * `syncBankFeed`. Labels only: no balance or number leaves the server here.
 */
export async function listAccountsToImport(
  userId: string,
): Promise<Result<{ accounts: { id: string; label: string }[] }>> {
  const connection = await getBankConnection(userId);
  if (!connection) {
    return { error: "bankConnect.notConnected" };
  }
  try {
    const accounts = await connection.client.getAccounts();
    return {
      accounts: accounts
        .filter((account) => !account.needsReconnect)
        .map((account) => ({
          id: account.id,
          label:
            account.displayName ??
            account.accountName ??
            account.aspspName ??
            "",
        })),
    };
  } catch (error) {
    return { error: (await noteSyncFailure(userId, error)).message };
  }
}

/** Bring in one account's whole history. */
export async function importOneAccount(
  supabase: Client,
  userId: string,
  accountId: string,
): Promise<Result<{ imported: number; pending: number }>> {
  try {
    const outcome = await syncBankFeed(supabase, userId, {
      backfill: true,
      accountIds: [accountId],
    });
    return { imported: outcome.imported, pending: outcome.pending };
  } catch (error) {
    return { error: (await noteSyncFailure(userId, error)).message };
  }
}

/**
 * The first import is done: remember it, and close the months the history
 * now explains. `backfilled_at` is written with the service role because the
 * connection row is read-only to its user.
 */
export async function finishFirstImport(
  supabase: Client,
  userId: string,
): Promise<{ monthsClosed: number }> {
  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("bank_connections")
      .update({
        backfilled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }
  await noteSyncHealthy(userId);
  const closes = await autoCloseMonths(supabase, userId);
  return { monthsClosed: closes.closed.length };
}
