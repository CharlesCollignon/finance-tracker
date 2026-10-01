import { cache } from "react";
import { cashDateOf } from "@finance/core/cash-date";
import {
  SAVINGS_KINDS,
  savingsBalance,
  savingsRate,
  type SavingsBalance,
} from "@finance/core/savings-accounts";
import type { SavingsAccountKind } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

/**
 * The savings accounts a user has declared (migration 046), each with what
 * it holds today, and the bank accounts one could be linked to.
 *
 * Read the same way by Placements and the Plan, so the balance a reader sees
 * on one is the one the other projects. Before 046 has run there are no
 * accounts and nothing can be added, which is said where adding is offered
 * rather than breaking the page.
 */

export interface SavingsAccountView {
  id: string;
  kind: SavingsAccountKind;
  balance: SavingsBalance;
  /** The rate in force: the account's own, or the law's. */
  rate: number;
  /** The account's own rate, when it has one (a PEL, a bank livret). */
  annualRate: number | null;
  categoryId: string | null;
  categoryName: string | null;
  bankAccountId: string | null;
  bankLabel: string | null;
  /** Its target share of everything kept (migration 047), or null. */
  targetWeight: number | null;
}

export interface LinkableBankAccount {
  id: string;
  label: string;
  balance: number | null;
}

export interface SavingsAccountsRead {
  accounts: SavingsAccountView[];
  /** Bank accounts not counted as spending money and not linked yet. */
  linkable: LinkableBankAccount[];
  /** False until migration 046 has run. */
  available: boolean;
}

/** Whether an error means migration 046 has not run. */
export function savingsSchemaMissing(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

/**
 * The earliest day a movement could still count, given the balances' dates.
 * A row's money can move up to a fortnight before the day it counts for (an
 * early salary's savings), so the read starts a little earlier and lets the
 * cash date decide.
 */
function readFrom(balanceDates: string[]): string | null {
  if (balanceDates.length === 0) {
    return null;
  }
  const earliest = [...balanceDates].sort()[0]!;
  const date = new Date(`${earliest}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 62);
  return date.toISOString().slice(0, 10);
}

export const getSavingsAccounts = cache(
  async (userId: string): Promise<SavingsAccountsRead> => {
    const supabase = await createClient();
    const [{ data: rows, error }, { data: bankRows }] = await Promise.all([
      supabase.from("savings_accounts").select("*").eq("user_id", userId),
      supabase
        .from("bank_accounts")
        .select(
          "provider_account_id, label, reported_balance, reported_on, counts_as_cash",
        )
        .eq("user_id", userId),
    ]);

    if (error) {
      if (savingsSchemaMissing(error)) {
        return { accounts: [], linkable: [], available: false };
      }
      throw error;
    }

    const accounts = rows ?? [];
    const bankAccounts = bankRows ?? [];
    const categoryIds = accounts
      .map((row) => row.category_id)
      .filter((id): id is string => id !== null);
    const from = readFrom(
      accounts.filter((row) => row.category_id).map((row) => row.balance_on),
    );

    const [{ data: categories }, { data: movements }] = await Promise.all([
      categoryIds.length > 0
        ? supabase
            .from("categories")
            .select("id, name")
            .eq("user_id", userId)
            .in("id", categoryIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      categoryIds.length > 0 && from
        ? supabase
            .from("transactions")
            .select("category_id, occurred_on, cash_on, amount")
            .eq("user_id", userId)
            .in("category_id", categoryIds)
            .gte("occurred_on", from)
        : Promise.resolve({
            data: [] as {
              category_id: string;
              occurred_on: string;
              cash_on: string | null;
              amount: number;
            }[],
          }),
    ]);

    const names = new Map(
      (categories ?? []).map((category) => [category.id, category.name]),
    );
    const moved = (movements ?? []).map((row) => ({
      categoryId: row.category_id,
      movedOn: cashDateOf(row),
      amount: Number(row.amount),
    }));
    const reported = bankAccounts.map((row) => ({
      provider_account_id: row.provider_account_id,
      reported_balance:
        row.reported_balance === null ? null : Number(row.reported_balance),
      reported_on: row.reported_on,
    }));

    const views = SAVINGS_KINDS.flatMap((kind): SavingsAccountView[] => {
      const row = accounts.find((account) => account.kind === kind);
      if (!row) {
        return [];
      }
      const bank = row.bank_account_id
        ? bankAccounts.find(
            (account) => account.provider_account_id === row.bank_account_id,
          )
        : undefined;
      return [
        {
          id: row.id,
          kind,
          balance: savingsBalance(row, moved, reported),
          rate: savingsRate(row),
          annualRate: row.annual_rate === null ? null : Number(row.annual_rate),
          categoryId: row.category_id,
          categoryName: row.category_id
            ? (names.get(row.category_id) ?? null)
            : null,
          bankAccountId: row.bank_account_id,
          bankLabel: bank?.label ?? null,
          // Absent before migration 047 has run, which reads as no target.
          targetWeight:
            row.target_weight === null || row.target_weight === undefined
              ? null
              : Number(row.target_weight),
        },
      ];
    });

    const linked = new Set(
      accounts
        .map((row) => row.bank_account_id)
        .filter((id): id is string => id !== null),
    );
    const linkable = bankAccounts
      .filter(
        (row) => !row.counts_as_cash && !linked.has(row.provider_account_id),
      )
      .map((row) => ({
        id: row.provider_account_id,
        label: row.label,
        balance:
          row.reported_balance === null ? null : Number(row.reported_balance),
      }));

    return { accounts: views, linkable, available: true };
  },
);
