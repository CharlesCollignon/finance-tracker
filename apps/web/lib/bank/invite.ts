import { bankSetupOffered } from "@/lib/bank/offer";
import { createClient } from "@/lib/supabase/server";

/** Where an invitation to connect a bank can appear. */
export type BankInviteSurface = "bearing" | "welcome" | "ledger" | "plan";

/**
 * Whether to invite this user to connect a bank on a surface.
 *
 * Only when this account may set one up (`bankSetupOffered`), only to someone with no
 * connection (a disconnected one counts as none), and never on a surface they
 * dismissed it from. Someone whose connection has ended sees "Reconnect" on
 * the Bank page and the Bearing's banner instead, not a sales pitch.
 */
export async function shouldInviteToConnect(
  userId: string,
  surface: BankInviteSurface,
): Promise<boolean> {
  if (!(await bankSetupOffered())) {
    return false;
  }
  const supabase = await createClient();
  const [{ data: connection }, { data: preferences }] = await Promise.all([
    supabase
      .from("bank_connections")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_preferences")
      .select("dismissed_prompts")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (connection && connection.status !== "revoked") {
    return false;
  }
  return !(preferences?.dismissed_prompts ?? []).includes(
    `bank-invite:${surface}`,
  );
}
