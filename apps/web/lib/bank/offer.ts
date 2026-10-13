import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { flagsFromRows, isFlagOn } from "@finance/core/flags";
import type { Database } from "@finance/core/types/database";
import { getAuthUser } from "@/lib/auth/get-user";
import { bankConnectAvailable, bankOpenTo } from "@/lib/bank/client";
import { getFlags } from "@/lib/flags";

/**
 * Whether the signed-in user may set up a bank connection.
 *
 * Three halves: the deployment can store one (`bankConnectAvailable`), the
 * account is the owner's (`bankOpenTo` — open-banking.io does not let its
 * customers hand their access to an app like Pluclair), and the
 * `bank.connect` flag is on for it. Checked again by the route that accepts
 * a file, not only by the pages that offer it.
 */
export async function bankSetupOffered(): Promise<boolean> {
  const user = await getAuthUser();
  return (
    bankConnectAvailable() &&
    user !== null &&
    bankOpenTo(user.id) &&
    isFlagOn(await getFlags(), "bank.connect")
  );
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
  const { data: who } = await supabase.auth.getUser();
  if (!who.user || !bankOpenTo(who.user.id)) {
    return false;
  }
  const { data, error } = await supabase.rpc("evaluated_feature_flags");
  return !error && isFlagOn(flagsFromRows(data), "bank.connect");
}
