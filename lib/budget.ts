import type {
  CategoryBreakdown,
  CategoryType,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@/lib/types/database";

export const MONTHS_IN_YEAR = 12;

export function getActiveYearlyExpenseTemplates(
  templates: RecurringTemplateWithCategory[],
): RecurringTemplateWithCategory[] {
  return templates.filter(
    (template) =>
      template.active &&
      template.recurrence === "yearly" &&
      template.categories.type === "expense",
  );
}

export function yearlyExpenseTemplateIds(
  templates: RecurringTemplateWithCategory[],
): Set<string> {
  return new Set(
    getActiveYearlyExpenseTemplates(templates).map((template) => template.id),
  );
}

export function amortizedMonthlyAmount(amount: number): number {
  return amount / MONTHS_IN_YEAR;
}

function isYearlyCashExpense(
  tx: TransactionWithCategory,
  yearlyIds: Set<string>,
): boolean {
  return (
    tx.categories.type === "expense" &&
    tx.recurring_template_id !== null &&
    yearlyIds.has(tx.recurring_template_id)
  );
}

function countsTowardSummary(tx: TransactionWithCategory): boolean {
  return tx.categories.counts_toward_summary !== false;
}

export interface MonthlyBudgetTotals {
  income: number;
  expense: number;
  savings: number;
  investment: number;
  deployed: number;
  outflow: number;
  net: number;
}

export function computeMonthlyBudget(
  transactions: TransactionWithCategory[],
  recurringTemplates: RecurringTemplateWithCategory[],
): MonthlyBudgetTotals {
  const yearlyIds = yearlyExpenseTemplateIds(recurringTemplates);
  const yearlyTemplates = getActiveYearlyExpenseTemplates(recurringTemplates);

  const totals = {
    income: 0,
    expense: 0,
    savings: 0,
    investment: 0,
    deployed: 0,
  };

  for (const tx of transactions) {
    const amount = Number(tx.amount);

    if (tx.categories.type === "income") {
      totals.income += amount;
      continue;
    }

    if (isYearlyCashExpense(tx, yearlyIds)) {
      continue;
    }

    if (tx.categories.type === "investment" && !countsTowardSummary(tx)) {
      totals.deployed += amount;
      continue;
    }

    if (countsTowardSummary(tx)) {
      totals[tx.categories.type as Exclude<CategoryType, "income">] += amount;
    }
  }

  for (const template of yearlyTemplates) {
    totals.expense += amortizedMonthlyAmount(Number(template.amount));
  }

  const outflow = totals.expense + totals.savings + totals.investment;

  return {
    ...totals,
    outflow,
    net: totals.income - outflow,
  };
}

export function buildBudgetExpenseBreakdown(
  transactions: TransactionWithCategory[],
  recurringTemplates: RecurringTemplateWithCategory[],
): CategoryBreakdown[] {
  const yearlyIds = yearlyExpenseTemplateIds(recurringTemplates);
  const yearlyTemplates = getActiveYearlyExpenseTemplates(recurringTemplates);
  const map = new Map<string, CategoryBreakdown>();

  for (const tx of transactions) {
    if (tx.categories.type !== "expense" || isYearlyCashExpense(tx, yearlyIds)) {
      continue;
    }

    const existing = map.get(tx.category_id);
    if (existing) {
      existing.total += Number(tx.amount);
    } else {
      map.set(tx.category_id, {
        categoryId: tx.category_id,
        name: tx.categories.name,
        type: tx.categories.type,
        icon: tx.categories.icon,
        total: Number(tx.amount),
      });
    }
  }

  for (const template of yearlyTemplates) {
    const share = amortizedMonthlyAmount(Number(template.amount));
    const existing = map.get(template.category_id);

    if (existing) {
      existing.total += share;
    } else {
      map.set(template.category_id, {
        categoryId: template.category_id,
        name: template.categories.name,
        type: template.categories.type,
        icon: template.categories.icon,
        total: share,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
