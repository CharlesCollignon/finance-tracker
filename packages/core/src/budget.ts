import type { BudgetViewMode } from "./constants";
import type {
  CategoryBreakdown,
  CategoryType,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "./types/database";
import { lastDayIsoOfMonth, todayIsoLocal } from "./constants";
import {
  filterDatesBySchedule,
  getRecurringOccurrenceDates,
} from "./recurrence";

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

  // Money that came back rather than came in. Netted off spending below.
  let reimbursed = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount);

    if (tx.categories.type === "income") {
      // An income category can be marked as not counting, and that is how a
      // reimbursement is told apart from earnings: a friend settling their
      // half of a subscription is not a second salary, and treating it as one
      // inflates income and leaves the whole expense standing, which flatters
      // the month twice over.
      if (countsTowardSummary(tx)) {
        totals.income += amount;
      } else {
        reimbursed += amount;
      }
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

  // Subtracted from spending rather than added to income, because that is
  // what it is: twelve euros paid out and nine returned is three euros spent.
  // Floored at zero so a month reimbursed more than it spent reads as having
  // spent nothing, rather than as negative spending.
  totals.expense = Math.max(0, totals.expense - reimbursed);

  const outflow =
    totals.expense + totals.savings + totals.investment + totals.deployed;

  return {
    ...totals,
    outflow,
    net: totals.income - outflow,
  };
}

function templateCountsTowardSummary(
  template: RecurringTemplateWithCategory,
): boolean {
  return template.categories.counts_toward_summary !== false;
}

function isYearlyExpenseTemplate(
  template: RecurringTemplateWithCategory,
): boolean {
  return (
    template.recurrence === "yearly" && template.categories.type === "expense"
  );
}

export function resolveBudgetAsOfDate(
  year: number,
  month: number,
  mode: BudgetViewMode,
): string {
  if (mode === "month_end") {
    return lastDayIsoOfMonth(year, month);
  }

  const today = todayIsoLocal();
  const monthEnd = lastDayIsoOfMonth(year, month);

  if (today > monthEnd) {
    return monthEnd;
  }

  if (today < `${year}-${String(month).padStart(2, "0")}-01`) {
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return today;
}

function filterTransactionsForBudget(
  transactions: TransactionWithCategory[],
  year: number,
  month: number,
  asOfDate: string,
): TransactionWithCategory[] {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  return transactions.filter(
    (tx) =>
      tx.occurred_on.startsWith(monthPrefix) && tx.occurred_on <= asOfDate,
  );
}

function appliedRecurringKeys(
  transactions: TransactionWithCategory[],
): Set<string> {
  return new Set(
    transactions
      .filter((tx) => tx.recurring_template_id)
      .map((tx) => `${tx.recurring_template_id}:${tx.occurred_on}`),
  );
}

function addProjectedOccurrences(
  totals: Omit<MonthlyBudgetTotals, "outflow" | "net">,
  recurringTemplates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  asOfDate: string,
  applied: Set<string>,
  skippedKeys: Set<string> = new Set(),
): void {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  for (const template of recurringTemplates) {
    if (!template.active || isYearlyExpenseTemplate(template)) {
      continue;
    }

    const dates = filterDatesBySchedule(
      getRecurringOccurrenceDates(
        {
          recurrence: template.recurrence ?? "monthly",
          day_of_month: template.day_of_month,
          day_of_week: template.day_of_week,
          month_of_year: template.month_of_year,
        },
        year,
        month,
      ),
      template.starts_on,
      template.ends_on,
    ).filter((date) => date.startsWith(monthPrefix) && date <= asOfDate);

    for (const date of dates) {
      const key = `${template.id}:${date}`;
      if (applied.has(key) || skippedKeys.has(key)) {
        continue;
      }

      const amount = Number(template.amount);
      const type = template.categories.type;

      if (type === "income") {
        totals.income += amount;
        continue;
      }

      if (type === "investment" && !templateCountsTowardSummary(template)) {
        totals.deployed += amount;
        continue;
      }

      if (templateCountsTowardSummary(template)) {
        totals[type as Exclude<CategoryType, "income">] += amount;
      }
    }
  }
}

export function computeMonthlyBudgetWithProjection(
  transactions: TransactionWithCategory[],
  recurringTemplates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  mode: BudgetViewMode,
  skippedKeys: Set<string> = new Set(),
): MonthlyBudgetTotals {
  const asOfDate = resolveBudgetAsOfDate(year, month, mode);
  const monthTxs = filterTransactionsForBudget(
    transactions,
    year,
    month,
    asOfDate,
  );
  const base = computeMonthlyBudget(monthTxs, recurringTemplates);
  const applied = appliedRecurringKeys(transactions);

  addProjectedOccurrences(
    base,
    recurringTemplates,
    year,
    month,
    asOfDate,
    applied,
    skippedKeys,
  );

  const outflow = base.expense + base.savings + base.investment + base.deployed;

  return {
    ...base,
    outflow,
    net: base.income - outflow,
  };
}

function addBreakdownAmount(
  map: Map<string, CategoryBreakdown>,
  row: {
    category_id: string;
    amount: number;
    categories: {
      name: string;
      type: CategoryType;
      icon: string | null;
    };
  },
): void {
  const existing = map.get(row.category_id);
  if (existing) {
    existing.total += Number(row.amount);
    return;
  }

  map.set(row.category_id, {
    categoryId: row.category_id,
    name: row.categories.name,
    type: row.categories.type,
    icon: row.categories.icon,
    total: Number(row.amount),
  });
}

function addTemplateBreakdownAmount(
  map: Map<string, CategoryBreakdown>,
  template: RecurringTemplateWithCategory,
  amount: number,
): void {
  const existing = map.get(template.category_id);
  if (existing) {
    existing.total += amount;
    return;
  }

  map.set(template.category_id, {
    categoryId: template.category_id,
    name: template.categories.name,
    type: template.categories.type,
    icon: template.categories.icon,
    total: amount,
  });
}

function buildProjectedBreakdown(
  transactions: TransactionWithCategory[],
  recurringTemplates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  mode: BudgetViewMode,
  matches: (tx: TransactionWithCategory) => boolean,
  matchesTemplate: (template: RecurringTemplateWithCategory) => boolean,
  skippedKeys: Set<string> = new Set(),
): CategoryBreakdown[] {
  const asOfDate = resolveBudgetAsOfDate(year, month, mode);
  const monthTxs = filterTransactionsForBudget(
    transactions,
    year,
    month,
    asOfDate,
  );
  const applied = appliedRecurringKeys(transactions);
  const map = new Map<string, CategoryBreakdown>();
  const yearlyIds = yearlyExpenseTemplateIds(recurringTemplates);

  for (const tx of monthTxs) {
    if (!matches(tx) || isYearlyCashExpense(tx, yearlyIds)) {
      continue;
    }

    addBreakdownAmount(map, tx);
  }

  for (const template of recurringTemplates) {
    if (!template.active || !matchesTemplate(template)) {
      continue;
    }

    if (isYearlyExpenseTemplate(template)) {
      if (matchesTemplate(template)) {
        addTemplateBreakdownAmount(
          map,
          template,
          amortizedMonthlyAmount(Number(template.amount)),
        );
      }
      continue;
    }

    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
    const dates = filterDatesBySchedule(
      getRecurringOccurrenceDates(
        {
          recurrence: template.recurrence ?? "monthly",
          day_of_month: template.day_of_month,
          day_of_week: template.day_of_week,
          month_of_year: template.month_of_year,
        },
        year,
        month,
      ),
      template.starts_on,
      template.ends_on,
    ).filter((date) => date.startsWith(monthPrefix) && date <= asOfDate);

    for (const date of dates) {
      const key = `${template.id}:${date}`;
      if (applied.has(key) || skippedKeys.has(key)) {
        continue;
      }

      addTemplateBreakdownAmount(map, template, Number(template.amount));
    }
  }

  return Array.from(map.values()).sort(
    (left, right) => right.total - left.total,
  );
}

export function buildBudgetExpenseBreakdownWithProjection(
  transactions: TransactionWithCategory[],
  recurringTemplates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  mode: BudgetViewMode,
  skippedKeys: Set<string> = new Set(),
): CategoryBreakdown[] {
  return buildProjectedBreakdown(
    transactions,
    recurringTemplates,
    year,
    month,
    mode,
    (tx) => tx.categories.type === "expense",
    (template) => template.categories.type === "expense",
    skippedKeys,
  );
}

export function buildBudgetSavingsBreakdownWithProjection(
  transactions: TransactionWithCategory[],
  recurringTemplates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  mode: BudgetViewMode,
  skippedKeys: Set<string> = new Set(),
): CategoryBreakdown[] {
  return buildProjectedBreakdown(
    transactions,
    recurringTemplates,
    year,
    month,
    mode,
    (tx) => tx.categories.type === "savings",
    (template) => template.categories.type === "savings",
    skippedKeys,
  );
}

export function buildBudgetInvestmentBreakdownWithProjection(
  transactions: TransactionWithCategory[],
  recurringTemplates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  mode: BudgetViewMode,
  deployment: boolean,
  skippedKeys: Set<string> = new Set(),
): CategoryBreakdown[] {
  return buildProjectedBreakdown(
    transactions,
    recurringTemplates,
    year,
    month,
    mode,
    (tx) =>
      tx.categories.type === "investment" &&
      countsTowardSummary(tx) === !deployment,
    (template) =>
      template.categories.type === "investment" &&
      templateCountsTowardSummary(template) === !deployment,
    skippedKeys,
  );
}

export function buildBudgetExpenseBreakdown(
  transactions: TransactionWithCategory[],
  recurringTemplates: RecurringTemplateWithCategory[],
): CategoryBreakdown[] {
  const yearlyIds = yearlyExpenseTemplateIds(recurringTemplates);
  const yearlyTemplates = getActiveYearlyExpenseTemplates(recurringTemplates);
  const map = new Map<string, CategoryBreakdown>();

  for (const tx of transactions) {
    if (
      tx.categories.type !== "expense" ||
      isYearlyCashExpense(tx, yearlyIds)
    ) {
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
