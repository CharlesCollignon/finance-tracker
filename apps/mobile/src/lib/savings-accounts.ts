import { cashDateOf } from "@finance/core/cash-date";
import { shiftIsoDate, todayIsoLocal } from "@finance/core/constants";
import {
  BITCOIN_INSTRUMENT,
  isCryptoWallet,
} from "@finance/core/crypto-holdings";
import {
  SAVINGS_KINDS,
  savingsBalance,
  savingsRate,
  type SavingsBalance,
  type SavingsMovement,
} from "@finance/core/savings-accounts";
import type {
  BankAccount,
  SavingsAccount,
  SavingsAccountKind,
  WalletId,
} from "@finance/core/types/database";
import { investmentPositionSchema } from "@finance/core/validations/investments";

import { getBankAccounts } from "@/lib/queries";
import { supabase } from "@/lib/supabase";

/**
 * The accounts a user keeps on Placements: their savings accounts (migration
 * 046), the wallets they added, and the custom holdings they create here.
 *
 * Reads and writes in one place, because Placements and the Plan both need
 * the same balances, and the Plan must not add up a Livret A differently
 * from the screen that shows it.
 */

type ActionResult = { error?: string; success?: boolean };

/** The table only exists once 046 has run; until then there is none. */
function isMissingSchema(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

async function requireUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/* ------------------------------------------------------------------ reading */

export interface SavingsAccountView {
  account: SavingsAccount;
  balance: SavingsBalance;
  /** Yearly, as a fraction: the account's own or the law's. */
  rate: number;
  /** The savings category that feeds it, by name, if it still has one. */
  categoryName: string | null;
}

export interface SavingsState {
  /** In `SAVINGS_KINDS` order. */
  accounts: SavingsAccountView[];
  /** The bank's accounts, for reading a balance from one. */
  bankAccounts: BankAccount[];
}

export async function getSavingsAccountRows(
  userId: string,
): Promise<SavingsAccount[]> {
  const { data, error } = await supabase
    .from("savings_accounts")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }
  return ((data ?? []) as SavingsAccount[]).map((row) => ({
    ...row,
    balance: Number(row.balance),
    annual_rate: row.annual_rate === null ? null : Number(row.annual_rate),
    // Absent until 047 has run.
    target_weight:
      row.target_weight === null || row.target_weight === undefined
        ? null
        : Number(row.target_weight),
  }));
}

/**
 * What was logged in the accounts' own categories, dated by the day the
 * money moved. Read from a little before the oldest balance, since a row
 * counted for one month can have moved in the month before.
 */
async function getSavingsMovements(
  userId: string,
  rows: readonly SavingsAccount[],
): Promise<SavingsMovement[]> {
  const categoryIds = rows
    .map((row) => row.category_id)
    .filter((id): id is string => id !== null);
  if (categoryIds.length === 0) {
    return [];
  }
  const oldest = rows
    .map((row) => row.balance_on)
    .sort()
    .at(0);

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .in("category_id", categoryIds);
  if (oldest) {
    query = query.gte("occurred_on", shiftIsoDate(oldest, -45));
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    categoryId: row.category_id as string,
    movedOn: cashDateOf(row),
    amount: Number(row.amount),
  }));
}

export async function getSavingsState(userId: string): Promise<SavingsState> {
  const [rows, bankAccounts] = await Promise.all([
    getSavingsAccountRows(userId),
    getBankAccounts(userId),
  ]);
  const categoryIds = rows
    .map((row) => row.category_id)
    .filter((id): id is string => id !== null);
  const [movements, names] = await Promise.all([
    getSavingsMovements(userId, rows),
    categoryIds.length > 0
      ? supabase
          .from("categories")
          .select("id, name")
          .eq("user_id", userId)
          .in("id", categoryIds)
          .then(({ data }) => data ?? [])
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  const reported = bankAccounts.map((account) => ({
    provider_account_id: account.provider_account_id,
    reported_balance:
      account.reported_balance === null
        ? null
        : Number(account.reported_balance),
    reported_on: account.reported_on,
  }));

  const accounts = SAVINGS_KINDS.flatMap((kind) => {
    const account = rows.find((row) => row.kind === kind);
    return account
      ? [
          {
            account,
            balance: savingsBalance(account, movements, reported),
            rate: savingsRate(account),
            categoryName:
              names.find((row) => row.id === account.category_id)?.name ?? null,
          },
        ]
      : [];
  });

  return { accounts, bankAccounts };
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

/**
 * The bank accounts a savings account could read its balance from: not the
 * spending accounts, and not one another savings account already reads.
 */
export function linkableBankAccounts(
  state: SavingsState,
  except?: string,
): BankAccount[] {
  const taken = new Set(
    state.accounts
      .map(({ account }) => account.bank_account_id)
      .filter((id): id is string => id !== null && id !== except),
  );
  return state.bankAccounts.filter(
    (account) =>
      !account.counts_as_cash && !taken.has(account.provider_account_id),
  );
}

/* ------------------------------------------------------------------ writing */

/**
 * Add a savings account, fed by a savings category of its own name — made
 * if the user has none by that name, so what they log in "LDDS" from now on
 * is added to the LDDS.
 */
export async function addSavingsAccount(input: {
  kind: SavingsAccountKind;
  /** The account's name in the reader's language: "LDDS", "Autre livret". */
  categoryName: string;
  balance: number;
  /** Null for the law's rate. */
  annualRate: number | null;
  bankAccountId: string | null;
}): Promise<ActionResult & { categoryName?: string }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  if (!Number.isFinite(input.balance) || input.balance < 0) {
    return { error: "errors.zeroOrMore" };
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .eq("type", "savings");
  if (categoriesError) {
    return { error: categoriesError.message };
  }

  const wanted = input.categoryName.trim();
  let category = (categories ?? []).find(
    (row) => row.name.trim().toLowerCase() === wanted.toLowerCase(),
  );
  if (!category) {
    const { data: created, error } = await supabase
      .from("categories")
      .insert({
        user_id: userId,
        name: wanted,
        type: "savings",
        icon: "piggy-bank",
        counts_toward_summary: true,
      })
      .select("id, name")
      .single();
    if (error || !created) {
      return { error: error?.message ?? "errors.invalidInput" };
    }
    category = created;
  }

  const { error } = await supabase.from("savings_accounts").insert({
    user_id: userId,
    kind: input.kind,
    balance: input.balance,
    balance_on: todayIsoLocal(),
    annual_rate: input.annualRate,
    category_id: category.id,
    bank_account_id: input.bankAccountId,
  });
  if (error) {
    return {
      error: isMissingSchema(error)
        ? "placementsPhone.accountsSetup"
        : error.message,
    };
  }
  return { success: true, categoryName: category.name };
}

/** A balance read today, or a new rate, or a bank account to read it from. */
export async function updateSavingsAccount(
  id: string,
  patch: {
    balance?: number;
    annualRate?: number | null;
    bankAccountId?: string | null;
  },
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  if (
    patch.balance !== undefined &&
    (!Number.isFinite(patch.balance) || patch.balance < 0)
  ) {
    return { error: "errors.zeroOrMore" };
  }

  const { error } = await supabase
    .from("savings_accounts")
    .update({
      ...(patch.balance === undefined
        ? {}
        : { balance: patch.balance, balance_on: todayIsoLocal() }),
      ...(patch.annualRate === undefined
        ? {}
        : { annual_rate: patch.annualRate }),
      ...(patch.bankAccountId === undefined
        ? {}
        : { bank_account_id: patch.bankAccountId }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

/**
 * Stop reading an account's balance from the bank, keeping the last balance
 * the bank reported, on the day it reported it, so nothing jumps.
 */
export async function unlinkSavingsAccount(
  view: SavingsAccountView,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error } = await supabase
    .from("savings_accounts")
    .update({
      bank_account_id: null,
      balance: view.balance.balance,
      balance_on: view.balance.asOf,
      updated_at: new Date().toISOString(),
    })
    .eq("id", view.account.id)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

/** The account goes; its category and what was logged in it stay. */
export async function removeSavingsAccount(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error } = await supabase
    .from("savings_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

/** Keep a wallet on Placements, positions or not. */
export async function showWallet(wallet: WalletId): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error } = await supabase.from("wallet_plans").upsert(
    {
      user_id: userId,
      wallet,
      shown: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,wallet" },
  );
  if (error) {
    return {
      error: isMissingSchema(error)
        ? "placementsPhone.accountsSetup"
        : error.message,
    };
  }
  return { success: true };
}

/**
 * Take a wallet off Placements: its positions go with it, since a wallet with
 * positions is always shown. The recurring entries that fed it stay.
 */
export async function removeWallet(wallet: WalletId): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error: positionsError } = await supabase
    .from("investment_positions")
    .delete()
    .eq("user_id", userId)
    .eq("wallet", wallet);
  if (positionsError) {
    return { error: positionsError.message };
  }
  const { error } = await supabase.from("wallet_plans").upsert(
    {
      user_id: userId,
      wallet,
      shown: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,wallet" },
  );
  if (error && !isMissingSchema(error)) {
    return { error: error.message };
  }
  return { success: true };
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
    return { error: error.message };
  }
  return { success: true };
}
