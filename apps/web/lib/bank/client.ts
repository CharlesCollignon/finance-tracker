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

/**
 * Why this user has no bank — which is two answers, not one.
 *
 * `getBankConnection` returns null for two quite different reasons: nothing
 * is configured, or something is and it is registered to somebody else.
 * This file already refuses that collapse for the bundle itself — a
 * malformed one is a configuration error and not "no bank" — and then
 * reintroduced it for the owner id, where it is worse: a bundle whose
 * `OPEN_BANKING_OWNER_USER_ID` does not match the signed-in user reads
 * exactly like no bundle at all. So the one person who has connected a bank
 * gets told there is nothing to reconcile with, and the deployment-wide
 * `bankFeedConfigured()` still lights up the control that promises to ask
 * it. A button that offers to reach your bank and then reports everything
 * fine without having reached it is the shape that bug took.
 *
 * Named rather than left to each call site to infer from a null, because
 * both apps have to say the same thing about it and neither can work it out
 * afterwards.
 */
export type BankFeedStatus =
  /** The bundle is here and it is this user's. */
  | "connected"
  /** No bundle on this deployment. Nothing is wrong; there is just no bank. */
  | "unconfigured"
  /** A bundle is here, registered to another account. */
  | "other-owner";

/**
 * Deliberately built on `getBankConnection` rather than repeating its
 * ownership test, so what the interface says can never drift from what the
 * sync will actually accept.
 */
export function bankFeedStatus(userId: string): BankFeedStatus {
  if (getBankConnection(userId)) {
    return "connected";
  }
  return bankFeedConfigured() ? "other-owner" : "unconfigured";
}

/**
 * What to tell someone whose refresh could not reach a bank, in words a
 * screen can show.
 *
 * Both surfaces read it from here so they cannot drift: the web action and
 * the route the phone calls were describing the same condition two different
 * ways, one of them ("Up to date") a claim about a bank that was never asked.
 * Mirrors `explain()` in `bank/pull`, which does the same job for a refusal.
 *
 * Each of these still follows a re-read, so each leads with what did happen.
 * "Reloaded" is the honest half of a refresh with no bank behind it: another
 * device may well have written something since.
 */
export function describeBankFeedStatus(
  status: Exclude<BankFeedStatus, "connected">,
): string {
  switch (status) {
    case "unconfigured":
      return "Reloaded — no bank is connected.";
    case "other-owner":
      // Deliberately says which half is wrong. The alternative was the
      // friendly "no bank", and on a single-user deployment that is the
      // sentence that hid a mistyped OPEN_BANKING_OWNER_USER_ID behind a
      // reassuring notice for as long as it took someone to file a bug.
      return "Reloaded — this deployment's bank credentials are registered to another account.";
  }
}

/**
 * Whether the feed belongs to this user in particular.
 *
 * The distinction from `bankFeedConfigured()` matters at a gate: that one
 * answers a deployment-wide question, while `getBankConnection` — which
 * `syncBankFeed` calls and throws on — is per-user. Gating a refresh on the
 * deployment-wide answer let a non-owner through the friendly "no bank"
 * branch and into that throw, so the same condition came back as a hard
 * error for them and as a soft notice for everyone else.
 */
export function bankFeedBelongsTo(userId: string): boolean {
  return bankFeedStatus(userId) === "connected";
}
