"use server";

import { getAuthUser } from "@/lib/auth/get-user";
import {
  finishFirstImport,
  importOneAccount,
  listAccountsToImport,
} from "@/lib/bank/first-import";
import { bankSetupOffered } from "@/lib/bank/offer";
import {
  connectUserBankFile,
  disconnectUserBank,
  recordUserBankConsent,
} from "@/lib/bank/service";
import type { BankInviteSurface } from "@/lib/bank/invite";
import { getLocale } from "@/lib/locale";
import { revalidateApp } from "@/lib/revalidate-paths";
import { createClient } from "@/lib/supabase/server";
import { dismissPrompt } from "@finance/data/preferences";

type Result<T = object> = ({ error?: undefined } & T) | { error: string };

/**
 * Connect a bank with the credentials file of the user's own open-banking.io
 * account. The file's text travels once, to here, and is sealed before it is
 * stored; see `lib/bank/credentials`.
 */
export async function connectBankFile(
  text: string,
  consentVersion: string,
): Promise<Result<{ outcome: "connected" | "paused"; accounts: number }>> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  if (!(await bankSetupOffered())) {
    return { error: "bankConnect.unavailable" };
  }
  const result = await connectUserBankFile(user.id, text, consentVersion);
  if (result.error === undefined) {
    revalidateApp();
  }
  return result;
}

/** Give today's consent on a connection that has none on record. */
export async function confirmBankConsent(
  consentVersion: string,
): Promise<Result> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const result = await recordUserBankConsent(user.id, consentVersion);
  if (result.error !== undefined) {
    return { error: result.error };
  }
  revalidateApp();
  return {};
}

/** The accounts a history import walks. See `listAccountsToImport`. */
export async function listImportAccounts(): Promise<
  Result<{ accounts: { id: string; label: string }[]; undecided: number }>
> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  return listAccountsToImport(await createClient(), user.id);
}

/**
 * Bring in one account's whole history.
 *
 * Every surface is redrawn after each account rather than once at the end,
 * so the rows appear as they land — and so a first import abandoned halfway
 * still shows what it did bring in.
 */
export async function importAccountHistory(
  accountId: string,
): Promise<Result<{ imported: number; pending: number }>> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const result = await importOneAccount(
    await createClient(),
    user.id,
    accountId,
  );
  revalidateApp();
  return result;
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
  revalidateApp();
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
  revalidateApp();
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
  const result = await dismissPrompt(
    await createClient(),
    user.id,
    `bank-invite:${surface}`,
    await getLocale(),
  );
  if (!result.success) {
    return { error: result.error };
  }
  // So going back to a page that showed the invitation does not show it
  // again from the browser's copy.
  revalidateApp();
  return {};
}
