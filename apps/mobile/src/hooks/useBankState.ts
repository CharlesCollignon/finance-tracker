import {
  bankAttention,
  type BankAttention,
} from "@finance/core/bank-attention";
import { todayIsoLocal } from "@finance/core/constants";

import { useRefreshable } from "@/hooks/useRefreshable";
import {
  readBankConnection,
  readBankServerFacts,
  readDismissedPrompts,
  type BankConnectionRow,
} from "@/lib/bank-connect";
import { useAuth } from "@/providers/AuthProvider";

export interface BankState {
  /** The user's own status row, or null when they never connected. */
  connection: BankConnectionRow | null;
  /** Whether this deployment can connect anybody at all. */
  available: boolean;
  /** Syncing on the deployment's own credentials, with no row. */
  ownerCredentials: boolean;
  /** The invitations dismissed, as `bank-invite:<surface>`. */
  dismissed: string[];
  /** What the connection asks of its owner today, if anything. */
  attention: BankAttention | null;
}

/**
 * Where this user's bank stands, for a screen that says so.
 *
 * One read per screen, shared by that screen's banner and invitation, so
 * the Bearing does not ask the same three questions twice. Reloads with the
 * bank and the dismissed invitations, like every screen's own data does: a
 * connection made or ended anywhere in the app redraws what depends on it.
 */
export function useBankState(): {
  bank: BankState | null;
  reload: () => Promise<void>;
} {
  const { user } = useAuth();
  const { data, reload } = useRefreshable(async () => {
    if (!user) {
      return null;
    }
    const [connection, facts, dismissed] = await Promise.all([
      readBankConnection(user.id),
      readBankServerFacts(user.id),
      readDismissedPrompts(user.id),
    ]);
    return {
      connection,
      ...facts,
      dismissed,
      // The same question the push and the web's banner ask, so the phone
      // never says "renew" on a morning the web says nothing.
      attention: bankAttention(connection, todayIsoLocal()),
    } satisfies BankState;
  }, [user?.id], { reads: ["bank", "preferences"] });

  return { bank: data, reload };
}
