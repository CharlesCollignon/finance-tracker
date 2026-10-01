import { OpenBankingClient } from "@open-banking-io/client";
import type { BankConnectionStatus } from "@finance/core/types/database";
import type { Key } from "@finance/core/i18n/t";
import {
  clientFor,
  credentialStore,
  readCredentials,
} from "@/lib/bank/credentials";
import { secretsConfigured } from "@/lib/bank/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Where a user's bank connection comes from.
 *
 * Two ways in, both the same file. Every user can upload the credentials
 * file of their own open-banking.io account, which is stored sealed, per user
 * (`lib/bank/credentials`). The owner bundle is how this started — the same
 * file, in an environment variable — and it stays until the owner uploads
 * theirs: a stored connection always wins over it, and it answers for nobody
 * but the owner.
 *
 * Everything downstream asks for a client by user id and does not care which
 * half answered. Neither the key nor the bundle may be sent to a browser,
 * logged, or returned from an action.
 */

export interface BankConnection {
  client: OpenBankingClient;
  /** How this connection was established, for the UI to be honest about. */
  source: "uploaded" | "owner-credentials";
}

/**
 * Which user the owner bundle belongs to. Without it a single-user bundle
 * would answer for whoever asked, which on a deployment with more than one
 * account would hand one person another's bank data.
 */
function ownerUserId(): string | null {
  return process.env.OPEN_BANKING_OWNER_USER_ID?.trim() || null;
}

/**
 * The bundle is handed to the SDK verbatim rather than picked apart here.
 *
 * Its shape is theirs to change — the private key sits under
 * `encryptionKey.privateKey`, which is not what the README's constructor
 * example suggests — and re-reading those field names in our own code is a
 * silent breakage waiting to happen: a missing key would read as "no bank
 * connected" rather than as the configuration error it is.
 */
function ownerClient(): OpenBankingClient | null {
  const raw = process.env.OPEN_BANKING_CREDENTIALS?.trim();
  if (!raw || !raw.startsWith("{")) {
    return null;
  }

  try {
    return OpenBankingClient.fromCredentials(raw);
  } catch {
    return null;
  }
}

function ownerConnection(userId: string): BankConnection | null {
  const owner = ownerUserId();
  if (!owner || owner !== userId) {
    return null;
  }
  const client = ownerClient();
  return client ? { client, source: "owner-credentials" } : null;
}

/** The connection row, read with the service role: the user may be absent. */
async function readStatus(
  userId: string,
): Promise<BankConnectionStatus | null> {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }
  const { data } = await admin
    .from("bank_connections")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.status ?? null;
}

export async function getBankConnection(
  userId: string,
): Promise<BankConnection | null> {
  const admin = createAdminClient();
  if (admin && secretsConfigured()) {
    const status = await readStatus(userId);
    if (status && status !== "revoked") {
      try {
        const credentials = await readCredentials(
          credentialStore(admin),
          userId,
        );
        if (credentials) {
          return { client: clientFor(credentials), source: "uploaded" };
        }
      } catch {
        // A secret that no longer opens — sealed under another environment's
        // BANK_SECRETS_KEY, as a rule — is a file to upload again, which the
        // status screen says. For the owner, the environment's own bundle
        // still reads the same account, so their feed does not stop over it;
        // for anyone else this is null.
        return ownerConnection(userId);
      }
    }
    if (status === "revoked") {
      return null;
    }
  }
  return ownerConnection(userId);
}

/**
 * Every user the unattended run should sync: each active connection, and the
 * owner while their bundle is still the environment's.
 */
export async function syncableUserIds(): Promise<string[]> {
  const ids = new Set<string>();
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("bank_connections")
      .select("user_id, last_synced_at")
      // Paused too: it costs one refused call a run, and it is how a wallet
      // topped up at open-banking.io comes back without anyone asking.
      .in("status", ["active", "error", "paused"])
      // Stalest first: if the run's budget ends partway, the users it did not
      // reach are the ones it reached most recently.
      .order("last_synced_at", { ascending: true, nullsFirst: true });
    for (const row of data ?? []) {
      ids.add(row.user_id);
    }
  }
  const owner = ownerUserId();
  if (owner && ownerClient()) {
    ids.add(owner);
  }
  return [...ids];
}

/**
 * Whether this deployment can store a bank connection at all: a key to seal
 * it with, and the service role to write where no app can read.
 *
 * Whether a given person is offered it is the `bank.connect` flag's answer on
 * top of this (`lib/bank/offer`), so the feature can be opened one account at
 * a time before it is opened to everyone.
 */
export function bankConnectAvailable(): boolean {
  return secretsConfigured() && createAdminClient() !== null;
}

/**
 * Where a user's bank stands, in the words both apps show.
 *
 * `connected` is the only one that syncs. The rest each have their own
 * sentence and their own button: renew, reconnect, top up, connect.
 */
export type BankFeedStatus =
  /** Syncing. */
  | "connected"
  /** open-banking.io stopped accepting the stored file's API key. */
  | "expired"
  /** open-banking.io suspended syncing — an unpaid wallet. */
  | "paused"
  /** The last sync failed for another reason; the next may work. */
  | "error"
  /** Nothing connected, or disconnected. */
  | "unconfigured";

export async function bankFeedStatus(userId: string): Promise<BankFeedStatus> {
  const status = await readStatus(userId);
  switch (status) {
    case "active":
      return (await getBankConnection(userId)) ? "connected" : "expired";
    case "expired":
    case "paused":
    case "error":
      return status;
    default:
      return ownerConnection(userId) ? "connected" : "unconfigured";
  }
}

/**
 * What to tell someone whose refresh could not reach a bank, in words a
 * screen can show.
 *
 * Both surfaces read it from here so they cannot drift: the web action and
 * the route the phone calls were describing the same condition two different
 * ways. Mirrors `explain()` in `bank/pull`, which does the same job for a
 * refusal. Each of these still follows a re-read, so each leads with what did
 * happen: "Reloaded" is the honest half of a refresh with no bank behind it.
 */
export function describeBankFeedStatus(
  status: Exclude<BankFeedStatus, "connected">,
): Key {
  // Message keys, resolved by the toast on either client.
  switch (status) {
    case "unconfigured":
      return "refresh.reloadedNoBank";
    case "expired":
      return "refresh.reloadedRejected";
    case "paused":
      return "refresh.reloadedPaused";
    case "error":
      return "refresh.reloadedUnreachable";
  }
}

/** Whether this user's bank syncs right now. */
export async function bankFeedBelongsTo(userId: string): Promise<boolean> {
  return (await bankFeedStatus(userId)) === "connected";
}
