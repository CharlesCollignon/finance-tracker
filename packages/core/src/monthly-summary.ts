import {
  buildBudgetExpenseBreakdownWithProjection,
  buildBudgetInvestmentBreakdownWithProjection,
  buildBudgetSavingsBreakdownWithProjection,
  computeMonthlyBudgetWithProjection,
} from "./budget";
import type { BudgetViewMode } from "./constants";
import type {
  MonthlySummary,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "./types/database";

export function buildMonthlySummary(
  transactions: TransactionWithCategory[],
  recurringTemplates: RecurringTemplateWithCategory[],
  year: number,
  month: number,
  view: BudgetViewMode,
  skippedKeys: Set<string> = new Set(),
): MonthlySummary {
  const budget = computeMonthlyBudgetWithProjection(
    transactions,
    recurringTemplates,
    year,
    month,
    view,
    skippedKeys,
  );

  return {
    income: budget.income,
    expenses: budget.expense,
    savings: budget.savings,
    investments: budget.investment,
    investmentDeployments: budget.deployed,
    remaining: budget.net,
    budgetView: view,
    expenseBreakdown: buildBudgetExpenseBreakdownWithProjection(
      transactions,
      recurringTemplates,
      year,
      month,
      view,
      skippedKeys,
    ),
    savingsBreakdown: buildBudgetSavingsBreakdownWithProjection(
      transactions,
      recurringTemplates,
      year,
      month,
      view,
      skippedKeys,
    ),
    investmentBreakdown: buildBudgetInvestmentBreakdownWithProjection(
      transactions,
      recurringTemplates,
      year,
      month,
      view,
      false,
      skippedKeys,
    ),
    investmentDeploymentBreakdown:
      buildBudgetInvestmentBreakdownWithProjection(
        transactions,
        recurringTemplates,
        year,
        month,
        view,
        true,
        skippedKeys,
      ),
  };
}
