import { cache } from "react";
import * as savings from "@finance/data/savings-accounts";
import type { SavingsBalance } from "@finance/core/savings-accounts";
import type { SavingsAccountKind } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

/**
 * The savings accounts a user has declared (migration 046), each with what
 * it holds today, and the bank accounts one could be linked to — read by
 * `@finance/data/savings-accounts`, shared with the phone, and shaped here
 * for the web's pages.
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

export const getSavingsAccounts = cache(
  async (userId: string): Promise<SavingsAccountsRead> => {
    const state = await savings.getSavingsAccounts(
      await createClient(),
      userId,
    );
    if (!state.available) {
      return { accounts: [], linkable: [], available: false };
    }

    const accounts = state.accounts.map(
      ({ account, balance, rate, categoryName }): SavingsAccountView => {
        const bank = account.bank_account_id
          ? state.bankAccounts.find(
              (row) => row.provider_account_id === account.bank_account_id,
            )
          : undefined;
        return {
          id: account.id,
          kind: account.kind,
          balance,
          rate,
          annualRate: account.annual_rate,
          categoryId: account.category_id,
          categoryName,
          bankAccountId: account.bank_account_id,
          bankLabel: bank?.label ?? null,
          targetWeight: account.target_weight,
        };
      },
    );

    const linkable = savings.linkableBankAccounts(state).map((row) => ({
      id: row.provider_account_id,
      label: row.label,
      balance:
        row.reported_balance === null ? null : Number(row.reported_balance),
    }));

    return { accounts, linkable, available: true };
  },
);
