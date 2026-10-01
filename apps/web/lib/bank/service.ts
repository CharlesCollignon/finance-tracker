import "server-only";
import { BANK_CONSENT_VERSION, consentIsCurrent } from "@finance/core/bank-consent";
import type { Key } from "@finance/core/i18n/t";
import {
  connectWithFile,
  credentialStore,
  type CredentialsProblem,
} from "@/lib/bank/credentials";
import { createAdminClient } from "@/lib/supabase/admin";

/** Each refusal, in the words both apps show. */
const PROBLEM_MESSAGE: Record<CredentialsProblem, Key> = {
  "too-large": "bankConnect.fileTooLarge",
  "not-json": "bankConnect.fileNotCredentials",
  "not-credentials": "bankConnect.fileNotCredentials",
  "missing-api-key": "bankConnect.fileMissingApiKey",
  "wrong-service": "bankConnect.fileWrongService",
  rejected: "bankConnect.fileRejected",
  "key-mismatch": "bankConnect.fileKeyMismatch",
  unreachable: "bankConnect.openBankingUnreachable",
};

/**
 * Take a user's credentials file, from either app.
 *
 * The caller has already decided the user may (`bankSetupOffered` on the
 * web, the same flag through the bearer session on the phone). The consent
 * shown beside the upload must come back with it, at today's version, or the
 * file is not even read. What comes back is an outcome or a message key —
 * never anything read from the file.
 */
export async function connectUserBankFile(
  userId: string,
  text: unknown,
  consentVersion: unknown,
): Promise<
  | { outcome: "connected" | "paused"; accounts: number; error?: undefined }
  | { error: Key }
> {
  const admin = createAdminClient();
  if (!admin) {
    return { error: "bankConnect.unavailable" };
  }
  if (typeof consentVersion !== "string" || !consentIsCurrent(consentVersion)) {
    return { error: "bankConnect.consentRequired" };
  }
  if (typeof text !== "string") {
    return { error: "bankConnect.fileNotCredentials" };
  }
  try {
    const result = await connectWithFile(
      { store: credentialStore(admin) },
      userId,
      text,
      { version: BANK_CONSENT_VERSION, givenAt: new Date().toISOString() },
    );
    return "problem" in result
      ? { error: PROBLEM_MESSAGE[result.problem] }
      : result;
  } catch {
    return { error: "bankConnect.saveFailed" };
  }
}

/**
 * Stop reading a user's bank, and optionally take back what it brought in.
 *
 * The credentials file is forgotten either way. `deleteImported` then removes
 * only the transactions the bank *wrote* — rows filed `auto:` or given a
 * category in the review — and never one it was merely matched against
 * (`match:`), which the user typed or a charge wrote before the bank saw it.
 * The bank's own rows and accounts go with them, so nothing is left behind to
 * keep the ledger bank-fed.
 */
export async function disconnectUserBank(
  userId: string,
  { deleteImported }: { deleteImported: boolean },
): Promise<{ removed: number }> {
  const admin = createAdminClient();
  if (!admin) {
    return { removed: 0 };
  }

  // The file is deleted here and now. The API key it held still exists at
  // open-banking.io until the user deletes it there, which the Bank page
  // tells them to do: Pluclair has no way to revoke a key it was handed.
  await credentialStore(admin).forgetConnection(userId);

  if (!deleteImported) {
    return { removed: 0 };
  }

  const { data: items } = await admin
    .from("bank_feed_items")
    .select("transaction_id, decided_by")
    .eq("user_id", userId)
    .not("transaction_id", "is", null);

  const written = (items ?? [])
    .filter((item) => !(item.decided_by ?? "").startsWith("match:"))
    .map((item) => item.transaction_id as string);

  let removed = 0;
  // In slices: an address with a few thousand ids is longer than PostgREST
  // accepts in one query string.
  for (let index = 0; index < written.length; index += 200) {
    const slice = written.slice(index, index + 200);
    const { count } = await admin
      .from("transactions")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .in("id", slice);
    removed += count ?? 0;
  }

  await admin.from("bank_feed_items").delete().eq("user_id", userId);
  await admin.from("bank_accounts").delete().eq("user_id", userId);

  return { removed };
}

/**
 * Record today's consent on an existing connection — one made before the
 * consent was asked at upload, or under words that have since changed.
 */
export async function recordUserBankConsent(
  userId: string,
  consentVersion: unknown,
): Promise<{ error?: Key }> {
  const admin = createAdminClient();
  if (!admin) {
    return { error: "bankConnect.unavailable" };
  }
  if (typeof consentVersion !== "string" || !consentIsCurrent(consentVersion)) {
    return { error: "bankConnect.consentRequired" };
  }
  const { error } = await admin
    .from("bank_connections")
    .update({
      consent_version: BANK_CONSENT_VERSION,
      consent_given_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .neq("status", "revoked");
  return error ? { error: "bankConnect.saveFailed" } : {};
}
