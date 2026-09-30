import { getBankConnection } from "@/lib/bank/client";
import {
  classifyBankError,
  recordFailure,
  recordHealthy,
  type BankFailure,
} from "@/lib/bank/health";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The health writes, for a refresh someone pressed rather than the cron.
 *
 * The cron already holds the service-role client; a person's refresh runs on
 * their own session, which cannot write `bank_connections`. So these reach
 * for the service role themselves, and do nothing on a deployment without
 * one — the refresh itself still worked.
 */
export async function noteSyncHealthy(userId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    return;
  }
  const connection = await getBankConnection(userId);
  if (connection) {
    await recordHealthy(admin, userId, connection.client);
  }
}

/** Records the failure and returns the words to show for it. */
export async function noteSyncFailure(
  userId: string,
  error: unknown,
): Promise<BankFailure> {
  const admin = createAdminClient();
  if (!admin) {
    return classifyBankError(error);
  }
  return recordFailure(admin, userId, error);
}
