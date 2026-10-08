import type { SupabaseClient } from "@supabase/supabase-js";
import { importsMovements } from "@finance/core/bank-accounts";
import type { Database } from "@finance/core/types/database";
import { autoCloseMonths } from "@/lib/bank/auto-close";
import { getBankConnection } from "@/lib/bank/client";
import { noteSyncFailure, noteSyncHealthy } from "@/lib/bank/health-note";
import { rememberAccounts, syncBankFeed } from "@/lib/bank/sync";
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
 * The accounts a history import walks, one per request — see `accountIds`
 * in `syncBankFeed`: the current accounts whose history is not in yet, so an
 * account the user starts following later gets its two years too. Every
 * account is recorded on the way, which is how the Bank page learns of one
 * it has to ask about (`undecided`, the readable accounts with no role).
 * Labels only: no balance or number leaves the server here.
 */
export async function listAccountsToImport(
  supabase: Client,
  userId: string,
): Promise<
  Result<{ accounts: { id: string; label: string }[]; undecided: number }>
> {
  const connection = await getBankConnection(userId);
  if (!connection) {
    return { error: "bankConnect.notConnected" };
  }
  try {
    const all = await connection.client.getAccounts();
    const remembered = await rememberAccounts(supabase, userId, all);
    const readable = all.filter((account) => !account.needsReconnect);
    return {
      accounts: readable
        .filter((account) => {
          const known = remembered.get(account.id);
          return importsMovements(known?.role) && !known?.historyImportedAt;
        })
        .map((account) => ({
          id: account.id,
          label:
            account.displayName ??
            account.accountName ??
            account.aspspName ??
            "",
        })),
      undecided: readable.filter(
        (account) => (remembered.get(account.id)?.role ?? null) === null,
      ).length,
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
    // Only once it was walked: an account that is not a current account,
    // or cannot be read, has had nothing brought in. A joint account the
    // partner connected first is done too: its copy feeds the space, this
    // one never will (`jointFeeders`).
    const { data: filed } = await supabase
      .from("bank_accounts")
      .select("role")
      .eq("user_id", userId)
      .eq("provider_account_id", accountId)
      .maybeSingle();
    if (outcome.accounts > 0 || filed?.role === "joint") {
      await supabase
        .from("bank_accounts")
        .update({ history_imported_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("provider_account_id", accountId);
    }
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
