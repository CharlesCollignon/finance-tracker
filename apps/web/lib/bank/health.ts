import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenBankingClient } from "@open-banking-io/client";
import type {
  BankConnectionStatus,
  Database,
} from "@finance/core/types/database";

/**
 * What the last attempt to read a user's bank says about their connection.
 *
 * Written after every sync, attended or not, so the status both apps show —
 * "connected", "renew", "paused" — is never older than the last time anyone
 * tried. Only rows that exist are touched: a user still on the owner's
 * environment bundle has no row until they upload their own file, and
 * inventing one here would read as a stored connection.
 */

type Client = SupabaseClient<Database>;

export interface BankFailure {
  status: Extract<BankConnectionStatus, "expired" | "paused" | "error">;
  /** Words a screen may show. Never the raw error, which can carry a path. */
  message: string;
}

/**
 * The SDK fails a read with a plain `Error` whose message carries the HTTP
 * status — "GET /accounts failed: 401 Unauthorized" — so the status is read
 * back out of it. 401 and 403 mean the API key in the user's credentials file
 * no longer reads their account — deleted at open-banking.io, as a rule; 402
 * is open-banking.io refusing until its wallet is paid.
 */
export function classifyBankError(error: unknown): BankFailure {
  const text = error instanceof Error ? error.message : String(error);
  const code = Number(/failed: (\d{3})/.exec(text)?.[1] ?? 0);
  if (code === 401 || code === 403) {
    return {
      status: "expired",
      message:
        "open-banking.io no longer accepts your credentials file. Upload a new one to sync again.",
    };
  }
  if (code === 402) {
    return {
      status: "paused",
      message:
        "open-banking.io has paused syncing until its wallet is topped up.",
    };
  }
  return {
    status: "error",
    message: "Your bank could not be reached. It will be tried again.",
  };
}

/** The earliest consent end across a user's bank connections, if any says. */
function earliestValidUntil(
  connections: readonly { validUntil: string | null | undefined }[],
): string | null {
  const dates = connections
    .map((connection) => connection.validUntil)
    .filter((date): date is string => Boolean(date))
    .sort();
  return dates[0] ?? null;
}

/**
 * The consent the renewal reminder counts down to: the earliest among the
 * banks where the user follows an account, as Courant or Épargne. A bank
 * connected and left aside is not theirs to renew, and one whose consent
 * lapsed long ago would otherwise keep the reminder on for good. Before any
 * account is followed, every bank counts.
 */
export function consentToWatch(
  connections: readonly {
    aspspName: string;
    validUntil: string | null | undefined;
  }[],
  followedBanks: ReadonlySet<string>,
): string | null {
  return earliestValidUntil(
    followedBanks.size === 0
      ? connections
      : connections.filter((connection) =>
          followedBanks.has(connection.aspspName),
        ),
  );
}

/**
 * When each bank stops sharing, by its name: the earliest of its consents,
 * when the user gave it more than one.
 */
export function consentByBank(
  connections: readonly {
    aspspName: string;
    validUntil: string | null | undefined;
  }[],
): Map<string, string> {
  const byBank = new Map<string, string>();
  for (const connection of connections) {
    const until = connection.validUntil;
    const known = byBank.get(connection.aspspName);
    if (until && (!known || until < known)) {
      byBank.set(connection.aspspName, until);
    }
  }
  return byBank;
}

export async function recordHealthy(
  admin: Client,
  userId: string,
  client: OpenBankingClient,
): Promise<void> {
  let consentValidUntil: string | null = null;
  try {
    const [connections, { data: followed }] = await Promise.all([
      client.getConnections(),
      admin
        .from("bank_accounts")
        .select("bank_name")
        .eq("user_id", userId)
        .in("role", ["spending", "savings", "joint"]),
    ]);
    consentValidUntil = consentToWatch(
      connections,
      new Set(
        (followed ?? [])
          .map((account) => account.bank_name)
          .filter((name): name is string => Boolean(name)),
      ),
    );
  } catch {
    // The statement was read; not knowing the consent date this time is not
    // a failed sync. The previous date stays.
  }
  const now = new Date().toISOString();
  await admin
    .from("bank_connections")
    .update({
      status: "active",
      last_synced_at: now,
      last_error: null,
      updated_at: now,
      ...(consentValidUntil ? { consent_valid_until: consentValidUntil } : {}),
    })
    .eq("user_id", userId)
    .neq("status", "revoked");
}

export async function recordFailure(
  admin: Client,
  userId: string,
  error: unknown,
): Promise<BankFailure> {
  const failure = classifyBankError(error);
  await admin
    .from("bank_connections")
    .update({
      status: failure.status,
      last_error: failure.message,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .neq("status", "revoked");
  return failure;
}
