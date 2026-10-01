import {
  envelopesFromData,
  monthlyContributions,
  type Envelope,
} from "@finance/core/future-plan";
import { defaultSavingsKind } from "@finance/core/savings-accounts";
import type { PlanBase, PlanWealth } from "@/lib/queries/plan";

/**
 * The accounts as the user's own figures describe them.
 *
 * The monthly payments come from the shared rule in core, so the phone opens
 * the long view on the same figures. Savings logged in a declared account's
 * own category go to that account; the rest go to the Livret A, or the first
 * account at hand — or, when none is declared, to everything saved in one.
 */
export function planEnvelopes(
  base: PlanBase,
  wealth: PlanWealth | null,
): Envelope[] {
  const kinds = base.savingsAccounts.map((account) => account.kind);
  return envelopesFromData({
    wallets: wealth?.wallets ?? {},
    savingsAccounts: base.savingsAccounts,
    savingsReserve: base.savingsReserve,
    monthly: monthlyContributions({
      templates: base.templates,
      wallets: wealth?.wallets ?? {},
      templateWallets: wealth?.templateWallets ?? {},
      savingsCategories: Object.fromEntries(
        base.savingsAccounts.flatMap((account) =>
          account.categoryId ? [[account.categoryId, account.kind]] : [],
        ),
      ),
      defaultSavings: defaultSavingsKind(kinds) ?? "savings",
      year: base.year,
      month: base.month,
      today: base.today,
    }),
  });
}
