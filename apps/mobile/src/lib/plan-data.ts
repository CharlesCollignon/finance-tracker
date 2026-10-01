import { supabase } from "@/lib/supabase";

type ActionResult = { error?: string; success?: boolean };

/**
 * Whether one connected account holds money the user spends.
 *
 * The Plan screen's counterpart to the web's `setAccountCountsAsCash`. The
 * web also tries the month's automatic close straight after, which needs the
 * server; here the next refresh from the web app does it. The Bank screen
 * writes the same column with the same filter.
 */
export async function setAccountCountsAsCash(
  providerAccountId: string,
  counts: boolean,
): Promise<ActionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const { error } = await supabase
    .from("bank_accounts")
    .update({ counts_as_cash: counts })
    .eq("user_id", user.id)
    .eq("provider_account_id", providerAccountId);

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}
