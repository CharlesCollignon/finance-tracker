import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { flagsFromRows, isFlagOn } from "@finance/core/flags";
import type { Database } from "@finance/core/types/database";
import { bankConnectAvailable } from "@/lib/bank/client";
import { getFlags } from "@/lib/flags";

/**
 * Whether the signed-in user may set up a bank connection.
 *
 * Both halves: the deployment can store one (`bankConnectAvailable`), and the
 * `bank.connect` flag is on for this account. The flag is what lets the owner
 * open it to a few people before everyone — and it is checked again by the
 * action that accepts a file, not only by the pages that offer it.
 */
export async function bankSetupOffered(): Promise<boolean> {
  return bankConnectAvailable() && isFlagOn(await getFlags(), "bank.connect");
}

/**
 * The same answer for a session that did not come from a cookie — the phone's
 * bearer routes, where `getFlags` has no request session to read.
 */
export async function bankSetupOfferedThrough(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  if (!bankConnectAvailable()) {
    return false;
  }
  const { data, error } = await supabase.rpc("evaluated_feature_flags");
  return !error && isFlagOn(flagsFromRows(data), "bank.connect");
}
