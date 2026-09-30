import type { SupabaseClient } from "@supabase/supabase-js";
import { OpenBankingClient } from "@open-banking-io/client";
import { z } from "zod";
import type { Database } from "@finance/core/types/database";
import { classifyBankError } from "./health";
import { needsReseal, openSecret, sealSecret, type Sealed } from "./secrets";

/**
 * A user's own open-banking.io account, connected by handing Pluclair the
 * credentials file open-banking.io lets them download.
 *
 * Each user signs up with open-banking.io, pays it, connects their bank there
 * and exports `credentials.json` — the API key that reads their account, and
 * the private key that decrypts what it returns. It is the same file the
 * deployment's owner keeps in the environment, per user instead of per
 * deployment, and it is the most sensitive thing this app holds: whoever has
 * it can read that person's whole bank history. So:
 *
 * - The file is parsed here and nowhere else, strictly, and never echoed: a
 *   problem comes back as one of a fixed set of codes, never as text from the
 *   file or from the SDK.
 * - Only the two keys are kept, sealed with `BANK_SECRETS_KEY` in a table no
 *   app can select (`bank_connection_secrets`, migration 041).
 * - The API address is not taken from the file. The SDK sends the API key to
 *   whatever `apiBaseUrl` says, so a file naming another host would have this
 *   server deliver a key — or reach an internal address — on anyone's say-so.
 *   The address is pinned; a file naming a different one is refused.
 * - `OpenBankingClient.fromCredentials` is never given user input: it reads a
 *   path from disk when its argument does not start with "{".
 */

type Client = SupabaseClient<Database>;

/** The only API a credentials file may be used against. */
export const OPEN_BANKING_API = "https://open-banking.io";

/**
 * Comfortably above a real file (under 1 KB: a key, a key pair and a few
 * labels) and far below anything worth parsing.
 */
export const MAX_CREDENTIALS_BYTES = 16 * 1024;

/** What Pluclair keeps of the file: the two keys, nothing else. */
export interface StoredCredentials {
  apiKey: string;
  privateKey: string;
}

/** Why a file was not accepted, as a code a screen turns into words. */
export type CredentialsProblem =
  /** Bigger than any credentials file. */
  | "too-large"
  /** Not JSON at all. */
  | "not-json"
  /** JSON, but not an open-banking.io credentials file. */
  | "not-credentials"
  /**
   * The export from open-banking.io's Encryption key card: the same file
   * name and the private key, but no API key — that export only includes one
   * when it is downloaded from an API key.
   */
  | "missing-api-key"
  /** A credentials file for some other API address. */
  | "wrong-service"
  /** open-banking.io refused the key: deleted, or never valid. */
  | "rejected"
  /** The key answered, but the private key does not open what it returned. */
  | "key-mismatch"
  /** open-banking.io could not be reached; nothing is wrong with the file. */
  | "unreachable";

const BASE64 = /^[A-Za-z0-9+/=_-]+$/;

const credentialsFile = z.object({
  apiBaseUrl: z.string().optional(),
  apiKey: z.string().trim().min(8).max(1024),
  encryptionKey: z.object({
    privateKey: z
      .string()
      .transform((value) => value.replace(/\s+/g, ""))
      .pipe(z.string().min(32).max(8192).regex(BASE64)),
  }),
});

/** A file with the private key where the API key should also be. */
function isKeyOnlyExport(json: unknown): boolean {
  if (typeof json !== "object" || json === null) {
    return false;
  }
  const file = json as { apiKey?: unknown; encryptionKey?: unknown };
  const key = file.encryptionKey as { privateKey?: unknown } | undefined;
  return (
    (file.apiKey === undefined || file.apiKey === "") &&
    typeof key?.privateKey === "string"
  );
}

function sameApi(url: string): boolean {
  return url.trim().replace(/\/+$/, "") === OPEN_BANKING_API;
}

/** Read an uploaded file into the two keys it carries, or say why not. */
export function parseCredentialsFile(
  text: string,
): { credentials: StoredCredentials } | { problem: CredentialsProblem } {
  if (new TextEncoder().encode(text).length > MAX_CREDENTIALS_BYTES) {
    return { problem: "too-large" };
  }
  let json: unknown;
  try {
    // A byte-order mark is what some editors add on saving; it is not JSON.
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { problem: "not-json" };
  }
  const parsed = credentialsFile.safeParse(json);
  if (!parsed.success) {
    return {
      problem: isKeyOnlyExport(json) ? "missing-api-key" : "not-credentials",
    };
  }
  if (parsed.data.apiBaseUrl && !sameApi(parsed.data.apiBaseUrl)) {
    return { problem: "wrong-service" };
  }
  return {
    credentials: {
      apiKey: parsed.data.apiKey,
      privateKey: parsed.data.encryptionKey.privateKey,
    },
  };
}

/** A client for stored credentials, always against the pinned API. */
export function clientFor(credentials: StoredCredentials): OpenBankingClient {
  return OpenBankingClient.fromBundle({
    apiBaseUrl: OPEN_BANKING_API,
    apiKey: credentials.apiKey,
    encryptionKey: { privateKey: credentials.privateKey },
  });
}

/** The status a freshly accepted file starts in. */
export type StartingStatus = "active" | "paused";

/** Where credentials are kept — the database in the app, memory in tests. */
export interface CredentialStore {
  saveConnection(
    userId: string,
    sealed: Sealed,
    status: StartingStatus,
  ): Promise<void>;
  readSecret(userId: string): Promise<Sealed | null>;
  replaceSecret(userId: string, sealed: Sealed): Promise<void>;
  forgetConnection(userId: string): Promise<void>;
}

export interface CredentialDeps {
  store: CredentialStore;
  /** Builds the client a file is tried with; the SDK in the app. */
  open?: (
    credentials: StoredCredentials,
  ) => Pick<OpenBankingClient, "getAccounts">;
}

export type ConnectResult =
  | { outcome: "connected" | "paused"; accounts: number }
  | { problem: CredentialsProblem };

/**
 * Accept a credentials file for a user: parse it, prove it reads their
 * account, then keep it.
 *
 * Tried before it is kept, so a file that cannot work is refused while the
 * person is still looking at the upload, rather than turning up hours later
 * as a sync that failed. A key that answers "pay first" (402) is a good key
 * on an empty wallet: it is kept, as paused, and the Bank page says where
 * to top up.
 */
export async function connectWithFile(
  deps: CredentialDeps,
  userId: string,
  text: string,
): Promise<ConnectResult> {
  const parsed = parseCredentialsFile(text);
  if ("problem" in parsed) {
    return parsed;
  }

  const open = deps.open ?? clientFor;
  let accounts = 0;
  let status: StartingStatus = "active";
  try {
    accounts = (await open(parsed.credentials).getAccounts()).length;
  } catch (error) {
    const failure = classifyBankError(error);
    if (failure.status === "paused") {
      status = "paused";
    } else if (failure.status === "expired") {
      return { problem: "rejected" };
    } else {
      // An HTTP failure carries its status in the message; anything else
      // happened on this side of the wire, and the only thing on this side
      // that can fail with a good key is decrypting with the wrong one.
      const http = /failed: \d{3}/.test(
        error instanceof Error ? error.message : "",
      );
      const network =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.name === "TimeoutError" ||
          error instanceof TypeError);
      return { problem: http || network ? "unreachable" : "key-mismatch" };
    }
  }

  await deps.store.saveConnection(
    userId,
    sealSecret(JSON.stringify(parsed.credentials)),
    status,
  );
  return { outcome: status === "active" ? "connected" : "paused", accounts };
}

/**
 * The stored credentials, opened. Re-sealed on the way when they were sealed
 * with a key being rotated out, so rotation finishes by itself as people use
 * the app.
 */
export async function readCredentials(
  store: CredentialStore,
  userId: string,
): Promise<StoredCredentials | null> {
  const sealed = await store.readSecret(userId);
  if (!sealed) {
    return null;
  }
  const plaintext = openSecret(sealed);
  if (needsReseal(sealed)) {
    await store.replaceSecret(userId, sealSecret(plaintext));
  }
  const value = JSON.parse(plaintext) as Partial<StoredCredentials>;
  return typeof value.apiKey === "string" &&
    typeof value.privateKey === "string"
    ? { apiKey: value.apiKey, privateKey: value.privateKey }
    : null;
}

/** The database's side of it, through the service role only. */
export function credentialStore(admin: Client): CredentialStore {
  return {
    async saveConnection(userId, sealed, status) {
      const { data: existing } = await admin
        .from("bank_connections")
        .select("status, connected_at, backfilled_at")
        .eq("user_id", userId)
        .maybeSingle();

      const { error: secretError } = await admin
        .from("bank_connection_secrets")
        .upsert({
          user_id: userId,
          ciphertext: sealed.ciphertext,
          key_id: sealed.keyId,
          created_at: new Date().toISOString(),
        });
      if (secretError) {
        throw new Error("Could not store the bank connection.");
      }

      // A new file for a live connection is a renewal: the history is
      // already here, so it is not imported again. After a disconnect, or on
      // the first file, the first import runs from the start.
      const continuing = existing !== null && existing.status !== "revoked";
      const now = new Date().toISOString();
      const { error } = await admin.from("bank_connections").upsert({
        user_id: userId,
        status,
        connected_at: continuing ? existing.connected_at : now,
        backfilled_at: continuing ? existing.backfilled_at : null,
        last_error: null,
        updated_at: now,
      });
      if (error) {
        throw new Error("Could not store the bank connection.");
      }
    },
    async readSecret(userId) {
      const { data } = await admin
        .from("bank_connection_secrets")
        .select("ciphertext, key_id")
        .eq("user_id", userId)
        .maybeSingle();
      return data ? { ciphertext: data.ciphertext, keyId: data.key_id } : null;
    },
    async replaceSecret(userId, sealed) {
      await admin
        .from("bank_connection_secrets")
        .update({ ciphertext: sealed.ciphertext, key_id: sealed.keyId })
        .eq("user_id", userId);
    },
    async forgetConnection(userId) {
      await admin
        .from("bank_connection_secrets")
        .delete()
        .eq("user_id", userId);
      await admin
        .from("bank_connections")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    },
  };
}
