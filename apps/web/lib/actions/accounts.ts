"use server";

import type { ActionResult } from "@finance/core/action-result";
import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import type {
  SavingsAccountKind,
  WalletId,
} from "@finance/core/types/database";
import * as savings from "@finance/data/savings-accounts";
import { asUser } from "@/lib/actions/as-user";
import { getT } from "@/lib/locale";

/**
 * Adding, changing and removing the accounts Placements keeps: savings
 * accounts (migration 046) and the investment wallets a user has.
 *
 * A savings account is one row per kind, fed by a savings category of its
 * own name — created on the spot, or the one already there — so what the
 * user logs as "LDDS" adds to the LDDS, and the recurring entries they file
 * there are what the Plan pays into it each month. The writes are
 * `@finance/data/savings-accounts`, shared with the phone; what is left here
 * is the web's plumbing and the sentences its toasts say.
 */

export async function addSavingsAccount(input: {
  kind: string;
  balance?: number;
  rate?: number | null;
  bankAccountId?: string | null;
}): Promise<ActionResult> {
  const t = await getT();
  const kind = input.kind as SavingsAccountKind;
  const name = ENVELOPE_SHORT_KEYS[kind] ? t(ENVELOPE_SHORT_KEYS[kind]) : "";
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await savings.addSavingsAccount(db, userId, {
      ...input,
      kind,
      name,
    });
    return result.success
      ? {
          success: true,
          message: t("accounts.addedSavings", {
            name,
            category: result.categoryName,
          }),
        }
      : { error: result.error };
  });
}

export async function addWallet(wallet: string): Promise<ActionResult> {
  const t = await getT();
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await savings.showWallet(db, userId, wallet as WalletId);
    return result.success
      ? {
          success: true,
          message: t("accounts.added", {
            name: t(ENVELOPE_SHORT_KEYS[wallet as WalletId]),
          }),
        }
      : { error: result.error };
  });
}

export async function updateSavingsBalance(
  id: string,
  balance: number,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    savings.setSavingsBalance(db, userId, id, balance),
  );
}

export async function updateSavingsRate(
  id: string,
  rate: number | null,
): Promise<ActionResult> {
  return asUser((db, userId) => savings.setSavingsRate(db, userId, id, rate));
}

export async function linkSavingsBank(
  id: string,
  bankAccountId: string | null,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    savings.linkSavingsBank(db, userId, id, bankAccountId),
  );
}

export async function removeSavingsAccount(id: string): Promise<ActionResult> {
  const t = await getT();
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await savings.removeSavingsAccount(db, userId, id);
    return result.success
      ? {
          success: true,
          message: result.kind
            ? t("accounts.removed", {
                name: t(ENVELOPE_SHORT_KEYS[result.kind]),
              })
            : undefined,
        }
      : { error: result.error };
  });
}

export async function removeWallet(wallet: string): Promise<ActionResult> {
  const t = await getT();
  return asUser(async (db, userId): Promise<ActionResult> => {
    const result = await savings.removeWallet(db, userId, wallet as WalletId);
    return result.success
      ? {
          success: true,
          message: t("accounts.removed", {
            name: t(ENVELOPE_SHORT_KEYS[wallet as WalletId]),
          }),
        }
      : { error: result.error };
  });
}
