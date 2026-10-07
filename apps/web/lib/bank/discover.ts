import type { SupabaseClient } from "@supabase/supabase-js";
import { awaitingRole } from "@finance/core/bank-accounts";
import type { Database } from "@finance/core/types/database";
import { getBankConnection } from "@/lib/bank/client";
import { consentByBank } from "@/lib/bank/health";
import { noteSyncFailure } from "@/lib/bank/health-note";
import { rememberAccounts } from "@/lib/bank/sync";

type Client = SupabaseClient<Database>;

/**
 * Look for the accounts the user's open-banking.io account holds, and bring
 * nothing in.
 *
 * A bank is added on open-banking.io, under the same credentials file, so
 * Pluclair learns of it by asking — when a file is accepted, and when the
 * user comes back from adding one. Every account is recorded, and how many
 * readable ones still wait for the user to say what they are comes back:
 * those are the Bank page's « Nouveaux comptes trouvés ».
 */
export async function discoverAccounts(
  supabase: Client,
  userId: string,
): Promise<{ awaiting: number; error?: undefined } | { error: string }> {
  const connection = await getBankConnection(userId);
  if (!connection) {
    return { error: "bankConnect.notConnected" };
  }
  try {
    const [accounts, consents] = await Promise.all([
      connection.client.getAccounts(),
      connection.client
        .getConnections()
        .then(consentByBank)
        .catch(() => undefined),
    ]);
    const remembered = await rememberAccounts(
      supabase,
      userId,
      accounts,
      consents,
    );
    return {
      awaiting: awaitingRole(
        accounts.map((account) => ({
          role: remembered.get(account.id)?.role ?? null,
          needs_reconnect: account.needsReconnect,
        })),
      ).length,
    };
  } catch (error) {
    return { error: (await noteSyncFailure(userId, error)).message };
  }
}
