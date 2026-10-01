import type { ActionResult } from "@finance/core/action-result";
import { cashDateOf } from "@finance/core/cash-date";
import { shiftIsoDate, todayIsoLocal } from "@finance/core/constants";
import {
  FRENCH_SAVINGS_2026,
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
import { walletIdSchema } from "@finance/core/validations/investments";
import { z } from "zod";

import type { Db } from "./client";
import { isMissingSchema } from "./schema";
import { dbError } from "./errors";

/**
 * The accounts a user keeps on Placements — their savings accounts
 * (migration 046) and the wallets they added — read and written once for
 * both apps.
 *
 * Placements and the Plan read the same balances on each app, so a Livret A
 * is never added up two ways. The phone's copy had drifted in what it wrote:
 * it took the typed balance of an account linked to a bank, fed a new
 * account from a savings category it found archived (which then stayed out
 * of every picker), and stored the law's rate as the account's own, so the
 * account no longer followed the law when the rate moved.
 */

/** What a write answers before migration 046 has run. */
const SETUP = "placementsWeb.setupNeeded";

const kindSchema = z.enum(
  SAVINGS_KINDS as [SavingsAccountKind, ...SavingsAccountKind[]],
);
const uuid = z.string().uuid();
const balanceSchema = z.number().finite().min(0).max(100_000_000);
/** A yearly rate as a fraction: 0.02 for 2%. */
const rateSchema = z.number().finite().min(0).max(0.2);

function failure(error: { code?: string; message: string }): {
  error: string;
} {
  return { error: isMissingSchema(error) ? SETUP : dbError(error) };
}

/** Only a PEL's and a bank livret's rate are the user's to set. */
function ownRate(
  kind: SavingsAccountKind,
  rate: number | null | undefined,
): number | null {
  if (kind !== "pel" && kind !== "livret") {
    return null;
  }
  if (rate === null || rate === undefined) {
    return null;
  }
  // The law's rate is stored as no rate, so it follows the law when it moves.
  return Math.abs(rate - FRENCH_SAVINGS_2026[kind].rate) < 1e-9 ? null : rate;
}

/* ------------------------------------------------------------------ reading */

export interface SavingsAccountRead {
  account: SavingsAccount;
  balance: SavingsBalance;
  /** Yearly, as a fraction: the account's own or the law's. */
  rate: number;
  /** The savings category that feeds it, by name, if it still has one. */
  categoryName: string | null;
}

export interface SavingsAccountsState {
  /** In `SAVINGS_KINDS` order. */
  accounts: SavingsAccountRead[];
  /** The bank's accounts, for reading a balance from one. */
  bankAccounts: BankAccount[];
  /** False until migration 046 has run. */
  available: boolean;
}

/** Every savings account row, with its numbers as numbers. */
export async function getSavingsAccountRows(
  db: Db,
  userId: string,
): Promise<SavingsAccount[] | null> {
  const { data, error } = await db
    .from("savings_accounts")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }
  return (data ?? []).map((row) => ({
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
 * money moved. Read from two months before the oldest balance: a row's money
 * can move up to a fortnight before the day it counts for (an early salary's
 * savings), and the cash date decides from there.
 */
async function getSavingsMovements(
  db: Db,
  userId: string,
  rows: readonly SavingsAccount[],
): Promise<SavingsMovement[]> {
  const fed = rows.filter((row) => row.category_id !== null);
  const categoryIds = fed.map((row) => row.category_id as string);
  const oldest = fed
    .map((row) => row.balance_on)
    .sort()
    .at(0);
  if (categoryIds.length === 0 || !oldest) {
    return [];
  }

  const { data, error } = await db
    .from("transactions")
    .select("category_id, occurred_on, cash_on, amount")
    .eq("user_id", userId)
    .in("category_id", categoryIds)
    .gte("occurred_on", shiftIsoDate(oldest, -62));
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    categoryId: row.category_id,
    movedOn: cashDateOf(row),
    amount: Number(row.amount),
  }));
}

/** Each savings account with what it holds today, and the bank's accounts. */
export async function getSavingsAccounts(
  db: Db,
  userId: string,
): Promise<SavingsAccountsState> {
  const [rows, { data: bankRows, error: bankError }] = await Promise.all([
    getSavingsAccountRows(db, userId),
    db.from("bank_accounts").select("*").eq("user_id", userId).order("label"),
  ]);

  if (bankError && !isMissingSchema(bankError)) {
    throw bankError;
  }
  const bankAccounts = bankRows ?? [];
  if (rows === null) {
    return { accounts: [], bankAccounts, available: false };
  }

  const categoryIds = rows
    .map((row) => row.category_id)
    .filter((id): id is string => id !== null);
  const [movements, { data: names }] = await Promise.all([
    getSavingsMovements(db, userId, rows),
    categoryIds.length > 0
      ? db
          .from("categories")
          .select("id, name")
          .eq("user_id", userId)
          .in("id", categoryIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const reported = bankAccounts.map((account) => ({
    provider_account_id: account.provider_account_id,
    reported_balance:
      account.reported_balance === null
        ? null
        : Number(account.reported_balance),
    reported_on: account.reported_on,
  }));

  const accounts = SAVINGS_KINDS.flatMap((kind): SavingsAccountRead[] => {
    const account = rows.find((row) => row.kind === kind);
    return account
      ? [
          {
            account,
            balance: savingsBalance(account, movements, reported),
            rate: savingsRate(account),
            categoryName:
              (names ?? []).find((row) => row.id === account.category_id)
                ?.name ?? null,
          },
        ]
      : [];
  });

  return { accounts, bankAccounts, available: true };
}

/**
 * The bank accounts a savings account could read its balance from: not the
 * spending accounts, and not one another savings account already reads —
 * `except` being the one asking, which may keep its own.
 */
export function linkableBankAccounts(
  state: Pick<SavingsAccountsState, "accounts" | "bankAccounts">,
  except?: string | null,
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

/** The savings category an account is fed by: its own name, made if missing. */
async function categoryFor(
  db: Db,
  userId: string,
  name: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const { data: existing, error } = await db
    .from("categories")
    .select("id, name, archived")
    .eq("user_id", userId)
    .eq("type", "savings");
  if (error) {
    return failure(error);
  }

  const wanted = name.trim();
  const match = (existing ?? []).find(
    (category) => category.name.trim().toLowerCase() === wanted.toLowerCase(),
  );
  if (match) {
    // An archived category of that name is the user's old one: brought
    // back, so what they log in it reaches the account and the pickers.
    if (match.archived) {
      await db
        .from("categories")
        .update({ archived: false })
        .eq("id", match.id)
        .eq("user_id", userId);
    }
    return { id: match.id, name: match.name };
  }

  const { data: created, error: createError } = await db
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
  if (createError || !created) {
    return failure(createError ?? { message: "errors.invalidInput" });
  }
  return created;
}

/**
 * Add a savings account, fed by a savings category of its own name — made
 * if the user has none by that name, so what they log in "LDDS" from now on
 * is added to the LDDS. `name` is that name in the reader's language.
 *
 * Linked to a bank account, it starts from the balance the bank reports, on
 * the day it reported it, whatever was typed.
 */
export async function addSavingsAccount(
  db: Db,
  userId: string,
  input: {
    kind: SavingsAccountKind;
    name: string;
    balance?: number;
    rate?: number | null;
    bankAccountId?: string | null;
  },
): Promise<ActionResult<{ categoryName: string }>> {
  if (!kindSchema.safeParse(input.kind).success || !input.name.trim()) {
    return { error: "errors.invalidInput" };
  }
  if (
    input.balance !== undefined &&
    !balanceSchema.safeParse(input.balance).success
  ) {
    return { error: "errors.zeroOrMore" };
  }
  if (
    input.rate !== undefined &&
    input.rate !== null &&
    !rateSchema.safeParse(input.rate).success
  ) {
    return { error: "errors.invalidInput" };
  }

  const today = todayIsoLocal();
  let balance = input.balance ?? 0;
  let balanceOn = today;
  if (input.bankAccountId) {
    const { data: bank } = await db
      .from("bank_accounts")
      .select("reported_balance, reported_on")
      .eq("user_id", userId)
      .eq("provider_account_id", input.bankAccountId)
      .maybeSingle();
    if (!bank) {
      return { error: "errors.invalidInput" };
    }
    balance = Math.max(0, Number(bank.reported_balance ?? 0));
    balanceOn = bank.reported_on ?? today;
  }

  const category = await categoryFor(db, userId, input.name);
  if ("error" in category) {
    return { error: category.error };
  }

  const { error } = await db.from("savings_accounts").insert({
    user_id: userId,
    kind: input.kind,
    balance: Math.round(balance * 100) / 100,
    balance_on: balanceOn,
    annual_rate: ownRate(input.kind, input.rate),
    category_id: category.id,
    bank_account_id: input.bankAccountId ?? null,
  });
  if (error) {
    return error.code === "23505"
      ? { error: "placementsWeb.alreadyAdded" }
      : failure(error);
  }

  return { success: true, categoryName: category.name };
}

/** The balance as the user reads it today. */
export async function setSavingsBalance(
  db: Db,
  userId: string,
  id: string,
  balance: number,
): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) {
    return { error: "errors.invalidInput" };
  }
  if (!balanceSchema.safeParse(balance).success) {
    return { error: "errors.zeroOrMore" };
  }

  const { error } = await db
    .from("savings_accounts")
    .update({
      balance: Math.round(balance * 100) / 100,
      balance_on: todayIsoLocal(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  return error ? failure(error) : { success: true, message: "accounts.saved" };
}

/** A PEL's or a bank livret's own rate; null goes back to the default. */
export async function setSavingsRate(
  db: Db,
  userId: string,
  id: string,
  rate: number | null,
): Promise<ActionResult> {
  if (
    !uuid.safeParse(id).success ||
    (rate !== null && !rateSchema.safeParse(rate).success)
  ) {
    return { error: "errors.invalidInput" };
  }

  const { data: row } = await db
    .from("savings_accounts")
    .select("kind")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db
    .from("savings_accounts")
    .update({
      annual_rate: ownRate(row.kind, rate),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  return error ? failure(error) : { success: true, message: "accounts.saved" };
}

/**
 * Read the balance from a bank account, or stop. Stopping keeps the last
 * balance the bank reported as the user's own, on the day it was reported,
 * so the account does not drop to what was typed months ago.
 */
export async function linkSavingsBank(
  db: Db,
  userId: string,
  id: string,
  bankAccountId: string | null,
): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) {
    return { error: "errors.invalidInput" };
  }

  const { data: row } = await db
    .from("savings_accounts")
    .select("bank_account_id, balance, balance_on")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) {
    return { error: "errors.invalidInput" };
  }

  const target = bankAccountId ?? row.bank_account_id;
  const { data: bank } = target
    ? await db
        .from("bank_accounts")
        .select("reported_balance, reported_on")
        .eq("user_id", userId)
        .eq("provider_account_id", target)
        .maybeSingle()
    : { data: null };
  if (bankAccountId && !bank) {
    return { error: "errors.invalidInput" };
  }

  const update =
    bankAccountId !== null
      ? { bank_account_id: bankAccountId }
      : {
          bank_account_id: null,
          balance:
            bank?.reported_balance === null ||
            bank?.reported_balance === undefined
              ? row.balance
              : Math.max(0, Number(bank.reported_balance)),
          balance_on: bank?.reported_on ?? row.balance_on,
        };

  const { error } = await db
    .from("savings_accounts")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  return error ? failure(error) : { success: true, message: "accounts.saved" };
}

/** The account goes; its category and what was logged in it stay. */
export async function removeSavingsAccount(
  db: Db,
  userId: string,
  id: string,
): Promise<ActionResult<{ kind?: SavingsAccountKind }>> {
  if (!uuid.safeParse(id).success) {
    return { error: "errors.invalidInput" };
  }

  const { data: removed, error } = await db
    .from("savings_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("kind")
    .maybeSingle();

  return error ? failure(error) : { success: true, kind: removed?.kind };
}

/** Keep a wallet on Placements, positions or not. */
export async function showWallet(
  db: Db,
  userId: string,
  wallet: WalletId,
): Promise<ActionResult> {
  if (!walletIdSchema.safeParse(wallet).success) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db.from("wallet_plans").upsert(
    {
      user_id: userId,
      wallet,
      shown: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,wallet" },
  );

  return error ? failure(error) : { success: true };
}

/**
 * A wallet off Placements: its holdings go, and it is no longer kept. The
 * recurring entries that bought into it stay — saving one again puts its
 * holding back, which is the user saying they still invest there.
 */
export async function removeWallet(
  db: Db,
  userId: string,
  wallet: WalletId,
): Promise<ActionResult> {
  if (!walletIdSchema.safeParse(wallet).success) {
    return { error: "errors.invalidInput" };
  }

  const { error: positionsError } = await db
    .from("investment_positions")
    .delete()
    .eq("user_id", userId)
    .eq("wallet", wallet);
  if (positionsError) {
    return failure(positionsError);
  }

  const { error } = await db.from("wallet_plans").upsert(
    {
      user_id: userId,
      wallet,
      shown: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,wallet" },
  );

  return error && !isMissingSchema(error) ? failure(error) : { success: true };
}
