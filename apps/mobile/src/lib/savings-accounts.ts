import {
  BITCOIN_INSTRUMENT,
  isCryptoWallet,
} from "@finance/core/crypto-holdings";
import type { ActionResult } from "@finance/core/action-result";
import type {
  SavingsAccountKind,
  WalletId,
} from "@finance/core/types/database";
import { investmentPositionSchema } from "@finance/core/validations/investments";
import * as savings from "@finance/data/savings-accounts";

import { supabase } from "@/lib/supabase";
import { dbError } from "@finance/data/errors";

/**
 * The accounts a user keeps on Placements: their savings accounts (migration
 * 046), the wallets they added, and the custom holdings they create here.
 *
 * The reads and writes are `@finance/data/savings-accounts`, the same as the
 * web's, so Placements and the Plan on either app add a Livret A up one way.
 * These wrappers keep the phone's names and shapes.
 */

async function requireUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function asUser<T extends object>(
  work: (userId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" } as ActionResult<T>;
  }
  return work(userId);
}

/* ------------------------------------------------------------------ reading */

export type SavingsAccountView = savings.SavingsAccountRead;

export type SavingsState = Pick<
  savings.SavingsAccountsState,
  "accounts" | "bankAccounts"
>;

export function getSavingsState(userId: string): Promise<SavingsState> {
  return savings.getSavingsAccounts(supabase, userId);
}

/** The savings category each account is fed by, for the monthly payments. */
export function savingsCategoryKinds(
  accounts: readonly SavingsAccountView[],
): Record<string, SavingsAccountKind> {
  const map: Record<string, SavingsAccountKind> = {};
  for (const { account } of accounts) {
    if (account.category_id) {
      map[account.category_id] = account.kind;
    }
  }
  return map;
}

export const linkableBankAccounts = savings.linkableBankAccounts;

/* ------------------------------------------------------------------ writing */

/**
 * Add a savings account, fed by a savings category of its own name — made
 * if the user has none by that name, brought back if it was archived.
 */
export async function addSavingsAccount(input: {
  kind: SavingsAccountKind;
  /** The account's name in the reader's language: "LDDS", "Autre livret". */
  categoryName: string;
  balance: number;
  /** Null for the law's rate. */
  annualRate: number | null;
  bankAccountId: string | null;
}): Promise<ActionResult<{ categoryName: string }>> {
  return asUser((userId) =>
    savings.addSavingsAccount(supabase, userId, {
      kind: input.kind,
      name: input.categoryName,
      balance: input.balance,
      rate: input.annualRate,
      bankAccountId: input.bankAccountId,
    }),
  );
}

/**
 * A balance read today, or a new rate, or a bank account to read it from —
 * each through the shared write for it, in that order, stopping at the first
 * that fails.
 */
export async function updateSavingsAccount(
  id: string,
  patch: {
    balance?: number;
    annualRate?: number | null;
    bankAccountId?: string | null;
  },
): Promise<ActionResult> {
  return asUser(async (userId): Promise<ActionResult> => {
    if (patch.balance !== undefined) {
      const result = await savings.setSavingsBalance(
        supabase,
        userId,
        id,
        patch.balance,
      );
      if (result.error) {
        return result;
      }
    }
    if (patch.annualRate !== undefined) {
      const result = await savings.setSavingsRate(
        supabase,
        userId,
        id,
        patch.annualRate,
      );
      if (result.error) {
        return result;
      }
    }
    if (patch.bankAccountId !== undefined) {
      return savings.linkSavingsBank(supabase, userId, id, patch.bankAccountId);
    }
    return { success: true };
  });
}

/**
 * Stop reading an account's balance from the bank, keeping the last balance
 * the bank reported, on the day it reported it, so nothing jumps.
 */
export async function unlinkSavingsAccount(
  view: SavingsAccountView,
): Promise<ActionResult> {
  return asUser((userId) =>
    savings.linkSavingsBank(supabase, userId, view.account.id, null),
  );
}

/** The account goes; its category and what was logged in it stay. */
export async function removeSavingsAccount(id: string): Promise<ActionResult> {
  return asUser(async (userId): Promise<ActionResult> => {
    const result = await savings.removeSavingsAccount(supabase, userId, id);
    return result.success ? { success: true } : { error: result.error };
  });
}

/** Keep a wallet on Placements, positions or not. */
export async function showWallet(wallet: WalletId): Promise<ActionResult> {
  return asUser((userId) => savings.showWallet(supabase, userId, wallet));
}

/**
 * Take a wallet off Placements: its positions go with it, since a wallet with
 * positions is always shown. The recurring entries that fed it stay.
 */
export async function removeWallet(wallet: WalletId): Promise<ActionResult> {
  return asUser((userId) => savings.removeWallet(supabase, userId, wallet));
}

/**
 * A holding typed in by hand: a name, what it cost and what it is worth. The
 * web's custom position, so an account added on the phone is never empty
 * for want of a recurring entry.
 */
export async function createInvestmentPosition(input: {
  wallet: WalletId;
  name: string;
  initialBalance: number;
  /** Null when the user leaves it for the market to say. */
  currentValue: number | null;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = investmentPositionSchema.safeParse({
    wallet: input.wallet,
    sourceType: "custom",
    name: input.name,
    initialBalance: input.initialBalance,
    currentValue: input.currentValue ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const crypto = isCryptoWallet(parsed.data.wallet);
  const { error } = await supabase.from("investment_positions").insert({
    user_id: userId,
    wallet: parsed.data.wallet,
    recurring_template_id: null,
    name: parsed.data.name?.trim() ?? "",
    category_id: null,
    initial_balance: parsed.data.initialBalance,
    current_value: parsed.data.currentValue,
    share_count: null,
    instrument_symbol: crypto ? BITCOIN_INSTRUMENT.symbol : null,
    instrument_name: crypto ? BITCOIN_INSTRUMENT.name : null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return { error: dbError(error) };
  }
  return { success: true };
}
