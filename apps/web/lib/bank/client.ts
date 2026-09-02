import { OpenBankingClient } from "@open-banking-io/client";

/**
 * Where a bank connection comes from.
 *
 * Two ways in exist, and only the first is wired. Single-user: the owner
 * connects their banks in open-banking.io's own app, exports the credentials
 * bundle, and it arrives here as one environment variable — no partner
 * application, no consent flow, nothing stored. Partner Connect: every user
 * connects their own bank through an OAuth flow, and the token plus their
 * private key is kept per user.
 *
 * The second needs an approved partner application, so this is a seam rather
 * than an implementation: everything downstream asks for a client by user id
 * and does not care which half answered. When the partner credentials arrive,
 * only this file changes.
 *
 * The bundle is a decryption key. It is read from the environment on the
 * server and must never be sent to a browser, logged, or returned from an
 * action.
 */

export interface BankConnection {
  client: OpenBankingClient;
  /** How this connection was established, for the UI to be honest about. */
  source: "owner-credentials";
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

export function getBankConnection(userId: string): BankConnection | null {
  const owner = ownerUserId();
  if (!owner || owner !== userId) {
    return null;
  }

  const client = ownerClient();
  return client ? { client, source: "owner-credentials" } : null;
}

/** Who the feed belongs to, for the unattended run that has no session. */
export function bankFeedOwnerId(): string | null {
  return ownerUserId() && ownerClient() ? ownerUserId() : null;
}

/** Whether this deployment could connect at all, for the UI to explain itself. */
export function bankFeedConfigured(): boolean {
  return Boolean(ownerUserId() && ownerClient());
}
