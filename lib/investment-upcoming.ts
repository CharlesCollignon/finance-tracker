import { formatShortDate } from "@/lib/constants";
import { displayNameForRecurringTemplate } from "@/lib/investment-positions";
import { resolveWalletId, type InvestmentWalletId } from "@/lib/investments";
import { getRecurringOccurrenceDates } from "@/lib/recurrence";
import type {
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@/lib/types/database";

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

export function buildUpcomingInvestments(
  templates: RecurringTemplateWithCategory[],
  transactions: TransactionWithCategory[],
  asOfDate: string,
): UpcomingInvestment[] {
  const [year, month] = asOfDate.split("-").map(Number);
  const applied = new Set(
    transactions
      .filter((tx) => tx.recurring_template_id)
      .map((tx) => `${tx.recurring_template_id}:${tx.occurred_on}`),
  );

  const upcoming: UpcomingInvestment[] = [];

  for (const template of templates) {
    if (!template.active || !isDeploymentInvestment(template)) {
      continue;
    }

    const dates = getRecurringOccurrenceDates(
      {
        recurrence: template.recurrence ?? "monthly",
        day_of_month: template.day_of_month,
        day_of_week: template.day_of_week,
        month_of_year: template.month_of_year,
      },
      year,
      month,
    ).filter((date) => date > asOfDate);

    for (const date of dates) {
      if (applied.has(`${template.id}:${date}`)) {
        continue;
      }

      upcoming.push({
        id: `${template.id}:${date}`,
        date,
        dateLabel: formatShortDate(date),
        name: displayNameForRecurringTemplate(template),
        walletId: resolveWalletId(template.categories.name),
        amount: Number(template.amount),
      });
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
