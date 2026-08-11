import { formatShortDate } from "./constants";
import { displayNameForRecurringTemplate } from "./investment-positions";
import {
  INVESTMENT_WALLET_IDS,
  resolveWalletId,
  type InvestmentWalletId,
} from "./investments";
import {
  estimateMonthlyAmount,
  getRecurringOccurrenceDates,
} from "./recurrence";
import type {
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "./types/database";

export interface UpcomingInvestment {
  id: string;
  date: string;
  dateLabel: string;
  name: string;
  walletId: InvestmentWalletId;
  amount: number;
}

function isDeploymentInvestment(
  template: RecurringTemplateWithCategory,
): boolean {
  return (
    template.categories.type === "investment" &&
    template.categories.counts_toward_summary === false
  );
}

function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function buildUpcomingInvestments(
  templates: RecurringTemplateWithCategory[],
  transactions: TransactionWithCategory[],
  asOfDate: string,
  skippedKeys: Set<string> = new Set(),
): UpcomingInvestment[] {
  const [year, month] = asOfDate.split("-").map(Number);
  const applied = new Set(
    transactions
      .filter((tx) => tx.recurring_template_id)
      .map((tx) => `${tx.recurring_template_id}:${tx.occurred_on}`),
  );

  // Look through this month and the next so monthly DCAs still surface
  // after the current month's date has passed.
  const months = [{ year, month }, shiftMonth(year, month, 1)];

  const upcoming: UpcomingInvestment[] = [];

  for (const template of templates) {
    if (!template.active || !isDeploymentInvestment(template)) {
      continue;
    }

    for (const window of months) {
      const dates = getRecurringOccurrenceDates(
        {
          recurrence: template.recurrence ?? "monthly",
          day_of_month: template.day_of_month,
          day_of_week: template.day_of_week,
          month_of_year: template.month_of_year,
        },
        window.year,
        window.month,
      ).filter((date) => date > asOfDate);

      for (const date of dates) {
        const key = `${template.id}:${date}`;
        if (applied.has(key) || skippedKeys.has(key)) {
          continue;
        }

        upcoming.push({
          id: key,
          date,
          dateLabel: formatShortDate(date),
          name: displayNameForRecurringTemplate(template),
          walletId: resolveWalletId(template.categories.name),
          amount: Number(template.amount),
        });
      }
    }
  }

  return upcoming.sort((left, right) => left.date.localeCompare(right.date));
}

export function sumUpcomingAmount(items: UpcomingInvestment[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function nextUpcomingByWallet(
  items: UpcomingInvestment[],
): Partial<Record<InvestmentWalletId, UpcomingInvestment>> {
  const next: Partial<Record<InvestmentWalletId, UpcomingInvestment>> = {};

  for (const item of items) {
    const existing = next[item.walletId];
    if (!existing || item.date < existing.date) {
      next[item.walletId] = item;
    }
  }

  return next;
}

export interface WalletFundingNeed {
  walletId: InvestmentWalletId;
  /** Typical cash to have in the wallet for this calendar month. */
  monthlyTotal: number;
}

/** PEA / CTO cash to fund: estimated monthly DCA total. */
export function buildWalletFundingNeeds(
  templates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  wallets: InvestmentWalletId[] = INVESTMENT_WALLET_IDS,
): WalletFundingNeed[] {
  return wallets.map((walletId) => {
    const monthlyTotal = templates
      .filter(
        (template) =>
          template.active &&
          isDeploymentInvestment(template) &&
          resolveWalletId(template.categories.name) === walletId,
      )
      .reduce(
        (sum, template) => sum + estimateMonthlyAmount(template, year, month),
        0,
      );

    return {
      walletId,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    };
  });
}
