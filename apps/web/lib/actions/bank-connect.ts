"use server";

import { getAuthUser } from "@/lib/auth/get-user";
import {
  finishFirstImport,
  importOneAccount,
  listAccountsToImport,
} from "@/lib/bank/first-import";
import { bankSetupOffered } from "@/lib/bank/offer";
import { connectUserBankFile, disconnectUserBank } from "@/lib/bank/service";
import type { BankInviteSurface } from "@/lib/bank/invite";
import { getLocale } from "@/lib/locale";
import { revalidateEverySurface } from "@/lib/revalidate-paths";
import { createClient } from "@/lib/supabase/server";

type Result<T = object> = ({ error?: undefined } & T) | { error: string };

/**
 * Connect a bank with the credentials file of the user's own open-banking.io
 * account. The file's text travels once, to here, and is sealed before it is
 * stored; see `lib/bank/credentials`.
 */
export async function connectBankFile(
  text: string,
): Promise<Result<{ outcome: "connected" | "paused"; accounts: number }>> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  if (!(await bankSetupOffered())) {
    return { error: "bankConnect.unavailable" };
  }
  const result = await connectUserBankFile(user.id, text);
  if (result.error === undefined) {
    revalidateEverySurface();
  }
  return result;
}

/** The accounts a first import walks. See `listAccountsToImport`. */
export async function listImportAccounts(): Promise<
  Result<{ accounts: { id: string; label: string }[] }>
> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  return listAccountsToImport(user.id);
}

/** Bring in one account's whole history. */
export async function importAccountHistory(
  accountId: string,
): Promise<Result<{ imported: number; pending: number }>> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  return importOneAccount(await createClient(), user.id, accountId);
}

/**
 * The first import is done: remember it, close the months the history now
 * explains, and redraw everything, because every surface just changed.
 */
export async function finishBankImport(): Promise<
  Result<{ monthsClosed: number }>
> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const result = await finishFirstImport(await createClient(), user.id);
  revalidateEverySurface();
  return result;
}

/** Stop syncing; keep or take back what the bank brought in. */
export async function disconnectBank(
  deleteImported: boolean,
): Promise<Result<{ removed: number }>> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const result = await disconnectUserBank(user.id, { deleteImported });
  revalidateEverySurface();
  return result;
}

/** Stop inviting this user to connect on one surface, on every device. */
export async function dismissBankInvite(
  surface: BankInviteSurface,
): Promise<Result> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  if (!["bearing", "welcome", "ledger", "plan"].includes(surface)) {
    return { error: "errors.invalidInput" };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("dismissed_prompts")
    .eq("user_id", user.id)
    .maybeSingle();
  const prompt = `bank-invite:${surface}`;
  const dismissed = new Set(data?.dismissed_prompts ?? []);
  dismissed.add(prompt);
  // Updated when the row exists; created with the language already in use
  // when it does not, because a new row's default of English would quietly
  // switch a French reader's app to English the next time it was read.
  const { error } = data
    ? await supabase
        .from("user_preferences")
        .update({
          dismissed_prompts: [...dismissed],
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
    : await supabase.from("user_preferences").insert({
        user_id: user.id,
        locale: await getLocale(),
        dismissed_prompts: [...dismissed],
      });
  return error ? { error: error.message } : {};
}
