import {
  bankAttention,
  type BankAttention,
} from "@finance/core/bank-attention";
import { awaitingRole } from "@finance/core/bank-accounts";
import { todayIsoLocal } from "@finance/core/constants";
import { getBankAccounts } from "@/lib/queries/bank-balance";
import { createClient } from "@/lib/supabase/server";

/**
 * What this user's bank connection asks of them today, read through their
 * own session: the status row is theirs to read, and nothing secret is near
 * it. A deployment's owner on its own credentials has no row, and so no
 * reminder — that feed has no consent date to count down to.
 */
export async function readBankAttention(
  userId: string,
): Promise<BankAttention | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_connections")
    .select("status, consent_valid_until")
    .eq("user_id", userId)
    .maybeSingle();
  return bankAttention(data, todayIsoLocal());
}

/**
 * How many accounts the bank shows that this user has not said anything
 * about yet: nothing of theirs is brought in until they do.
 */
export async function countAccountsAwaitingRole(
  userId: string,
): Promise<number> {
  return awaitingRole(await getBankAccounts(userId)).length;
}
