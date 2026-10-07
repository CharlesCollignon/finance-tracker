import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import type { Locale } from "@finance/core/i18n/locale";
import type { BankConnectionStatus } from "@finance/core/types/database";

import {
  ignoreFeedItem,
  importFeedItem,
  undoFeedDecision,
} from "@/lib/mutations";
import { supabase } from "@/lib/supabase";
import { notifyDataChanged } from "@/lib/data-version";
import { callWebApi, webApiAvailable } from "@/lib/web-api";
import * as preferences from "@finance/data/preferences";

/**
 * Connecting a bank from the phone, and looking after it afterwards.
 *
 * The user brings their own open-banking.io account and hands over the
 * credentials file it lets them download. The phone only carries that file
 * once, to the web server (`/api/bank/credentials`), which checks it and
 * seals it; the phone never keeps it, and deletes the copy the picker made.
 * Everything that needs the key — the first import, a disconnect — is asked
 * of the server the same way, and everything that does not is read straight
 * from the user's own rows.
 */

/** The user's own open-banking.io account, and where its file is downloaded. */
export const OPEN_BANKING_APP = "https://open-banking.io/app";
export const OPEN_BANKING_DEVELOPERS = "https://open-banking.io/app/developers";

/** Mirrors the server's `MAX_CREDENTIALS_BYTES`: refused before it is sent. */
const MAX_CREDENTIALS_BYTES = 16 * 1024;

export type BankInviteSurface = "bearing" | "welcome" | "ledger" | "plan";

export interface BankConnectionRow {
  status: BankConnectionStatus;
  consent_version: string | null;
  connected_at: string;
  last_synced_at: string | null;
  consent_valid_until: string | null;
  backfilled_at: string | null;
}

/** The user's own status row: readable to them, and nothing secret near it. */
export async function readBankConnection(
  userId: string,
): Promise<BankConnectionRow | null> {
  const { data, error } = await supabase
    .from("bank_connections")
    .select(
      "status, connected_at, last_synced_at, consent_valid_until, backfilled_at, consent_version",
    )
    .eq("user_id", userId)
    .maybeSingle();
  // A database without the migration yet reads as "not connected" rather
  // than an error screen: there is simply nothing to show.
  return error ? null : ((data as BankConnectionRow | null) ?? null);
}

export interface BankServerFacts {
  /** Whether this deployment can connect anybody at all. */
  available: boolean;
  /** Syncing on the deployment's own credentials, with no row of its own. */
  ownerCredentials: boolean;
}

const SERVER_FACTS_TTL_MS = 10 * 60 * 1000;
let serverFacts: {
  userId: string;
  at: number;
  facts: BankServerFacts;
} | null = null;

/**
 * What only the server knows, remembered for a few minutes.
 *
 * Three tabs ask whether to show an invitation, and the answer is a property
 * of the deployment that changes when somebody edits its environment — not
 * between one tab and the next. A failure is not remembered, so a phone that
 * was offline asks again next time rather than hiding the invitations for
 * ten minutes.
 */
export async function readBankServerFacts(
  userId: string,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<BankServerFacts> {
  const none: BankServerFacts = { available: false, ownerCredentials: false };
  if (!webApiAvailable()) {
    return none;
  }
  if (
    !fresh &&
    serverFacts?.userId === userId &&
    Date.now() - serverFacts.at < SERVER_FACTS_TTL_MS
  ) {
    return serverFacts.facts;
  }
  const result = await callWebApi<Partial<BankServerFacts>>(
    "/api/bank/status",
    { method: "GET", timeoutMs: 15_000 },
  );
  if (!result.ok) {
    return none;
  }
  const facts = {
    available: result.available === true,
    ownerCredentials: result.ownerCredentials === true,
  };
  serverFacts = { userId, at: Date.now(), facts };
  return facts;
}

/** Which invitations this user has dismissed, on any device. */
export function readDismissedPrompts(userId: string): Promise<string[]> {
  return preferences.readDismissedPrompts(supabase, userId);
}

/**
 * The same rule as the web's `shouldInviteToConnect`: only where connecting
 * is possible, only for someone with no live connection, and never on a
 * surface they dismissed it from.
 */
export function shouldInvite(
  surface: BankInviteSurface,
  {
    available,
    connection,
    dismissed,
  }: {
    available: boolean;
    connection: BankConnectionRow | null;
    dismissed: readonly string[];
  },
): boolean {
  if (!available) {
    return false;
  }
  if (connection && connection.status !== "revoked") {
    return false;
  }
  return !dismissed.includes(`bank-invite:${surface}`);
}

/** Stop inviting on one surface, for good and on every device. */
export async function dismissBankInvite(
  userId: string,
  surface: BankInviteSurface,
  locale: Locale,
): Promise<{ error?: string }> {
  const result = await preferences.dismissPrompt(
    supabase,
    userId,
    `bank-invite:${surface}`,
    locale,
  );
  return result.success ? {} : { error: result.error };
}

export type FileConnectResult =
  | { outcome: "connected" | "paused"; accounts: number }
  | { error: string }
  | { canceled: true };

/**
 * Pick the credentials file and hand it to the server.
 *
 * The picker copies the file into the app's cache to make it readable; that
 * copy is a key to someone's bank history, so it is deleted as soon as it has
 * been read, whatever happens next.
 */
export async function connectBankFromFile(
  consentVersion: string,
): Promise<FileConnectResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    // Providers label JSON inconsistently, and some give no type at all, so
    // the filter stays wide and the server decides.
    type: ["application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) {
    return { canceled: true };
  }
  const asset = picked.assets[0];

  let text: string;
  try {
    if ((asset.size ?? 0) > MAX_CREDENTIALS_BYTES) {
      return { error: "bankConnect.fileTooLarge" };
    }
    text = await new File(asset.uri).text();
  } catch {
    return { error: "bankConnect.fileNotCredentials" };
  } finally {
    try {
      new File(asset.uri).delete();
    } catch {
      // Already gone, or the provider handed over a file we cannot delete.
    }
  }

  const sent = await callWebApi<{ outcome?: unknown; accounts?: unknown }>(
    "/api/bank/credentials",
    { body: { text, consentVersion } },
  );
  if (!sent.ok) {
    return { error: sent.error };
  }
  return {
    outcome: sent.outcome === "paused" ? "paused" : "connected",
    accounts: typeof sent.accounts === "number" ? sent.accounts : 0,
  };
}

export interface ImportAccount {
  id: string;
  label: string;
}

/**
 * The current accounts whose history is not in yet, one request each, and
 * how many readable accounts still wait for the user to say what they are.
 */
export async function listImportAccounts(): Promise<
  { accounts: ImportAccount[]; undecided: number } | { error: string }
> {
  const result = await callWebApi<{
    accounts?: ImportAccount[];
    undecided?: number;
  }>("/api/bank/import", { method: "GET" });
  return result.ok
    ? { accounts: result.accounts ?? [], undecided: result.undecided ?? 0 }
    : { error: result.error };
}

/** One account's whole history. */
export async function importAccountHistory(
  accountId: string,
): Promise<{ imported: number; pending: number } | { error: string }> {
  const result = await callWebApi<{ imported?: number; pending?: number }>(
    "/api/bank/import",
    { body: { accountId } },
  );
  return result.ok
    ? { imported: result.imported ?? 0, pending: result.pending ?? 0 }
    : { error: result.error };
}

/**
 * Look for accounts at a bank added on open-banking.io since, bringing
 * nothing in, and say how many wait to be told what they are. When some do,
 * the screens that list accounts read them again.
 */
export async function findNewBankAccounts(): Promise<
  { awaiting: number } | { error: string }
> {
  const result = await callWebApi<{ awaiting?: number }>("/api/bank/accounts", {
    body: {},
  });
  if (!result.ok) {
    return { error: result.error };
  }
  const awaiting = result.awaiting ?? 0;
  if (awaiting > 0) {
    notifyDataChanged("bank");
  }
  return { awaiting };
}

/** The first import is done: remembered, and the months it explains closed. */
export async function finishBankImport(): Promise<{ error?: string }> {
  const result = await callWebApi<{ monthsClosed?: number }>(
    "/api/bank/import/finish",
  );
  return result.ok ? {} : { error: result.error };
}

/** Stop syncing; keep or take back what the bank brought in. */
export async function disconnectBank(
  deleteImported: boolean,
): Promise<{ removed: number } | { error: string }> {
  const result = await callWebApi<{ removed?: number }>(
    "/api/bank/disconnect",
    { body: { deleteImported } },
  );
  return result.ok ? { removed: result.removed ?? 0 } : { error: result.error };
}

/** A group's decision, as the web's batch actions report it. */
export interface GroupDecision {
  imported: number;
  matched: number;
  ignored: number;
  /** Every row the decision took, so all of it can be taken back. */
  decidedIds: string[];
}

/**
 * A build with no web app to ask — a development build without
 * `EXPO_PUBLIC_WEB_APP_URL` — still has a feed the web's cron filled, so the
 * review keeps working there the way it always has: row by row, through the
 * phone's own single-row decisions and their own duplicate check.
 */
async function decideRowByRow(
  ids: string[],
  decide: (id: string) => Promise<{ error?: string; duplicateOf?: string }>,
  counted: "imported" | "ignored",
): Promise<GroupDecision | { error: string }> {
  const decision: GroupDecision = {
    imported: 0,
    matched: 0,
    ignored: 0,
    decidedIds: [],
  };
  for (const id of ids) {
    const result = await decide(id);
    if (result.error) {
      if (decision.decidedIds.length === 0) {
        return { error: result.error };
      }
      continue;
    }
    decision.decidedIds.push(id);
    if (result.duplicateOf) {
      decision.matched += 1;
    } else {
      decision[counted] += 1;
    }
  }
  return decision;
}

async function decideGroup(
  body: Record<string, unknown>,
): Promise<GroupDecision | { error: string }> {
  const result = await callWebApi<Partial<GroupDecision>>("/api/bank/feed", {
    body,
  });
  if (!result.ok) {
    return { error: result.error };
  }
  return {
    imported: result.imported ?? 0,
    matched: result.matched ?? 0,
    ignored: result.ignored ?? 0,
    decidedIds: result.decidedIds ?? [],
  };
}

/**
 * File every row of a group under one category — on the server, so the
 * duplicate check is the web's own and a group filed on the phone is filed
 * exactly as it would have been there.
 */
export function fileFeedGroup(ids: string[], categoryId: string) {
  return webApiAvailable()
    ? decideGroup({ action: "import", ids, categoryId })
    : decideRowByRow(ids, (id) => importFeedItem(id, categoryId), "imported");
}

/** Leave every row of a group out. */
export function leaveOutFeedGroup(ids: string[]) {
  return webApiAvailable()
    ? decideGroup({ action: "ignore", ids })
    : decideRowByRow(ids, ignoreFeedItem, "ignored");
}

/** Put a group's rows back in the review, taking back what they wrote. */
export async function reopenFeedGroup(
  ids: string[],
): Promise<{ reopened: number } | { error: string }> {
  if (!webApiAvailable()) {
    let reopened = 0;
    for (const id of ids) {
      if (!(await undoFeedDecision(id)).error) {
        reopened += 1;
      }
    }
    return { reopened };
  }
  const result = await callWebApi<{ reopened?: number }>("/api/bank/feed", {
    body: { action: "undo", ids },
  });
  return result.ok
    ? { reopened: result.reopened ?? ids.length }
    : { error: result.error };
}

/** Give today's consent on an existing connection (`/api/bank/consent`). */
export async function confirmBankConsent(
  consentVersion: string,
): Promise<{ error?: string }> {
  const sent = await callWebApi<object>("/api/bank/consent", {
    body: { consentVersion },
  });
  return sent.ok ? {} : { error: sent.error };
}
