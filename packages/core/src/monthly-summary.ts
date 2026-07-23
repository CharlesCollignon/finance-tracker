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
): MonthlySummary {
  const budget = computeMonthlyBudgetWithProjection(
    transactions,
    recurringTemplates,
    year,
    month,
    view,
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
    ),
    savingsBreakdown: buildBudgetSavingsBreakdownWithProjection(
      transactions,
      recurringTemplates,
      year,
      month,
      view,
    ),
    investmentBreakdown: buildBudgetInvestmentBreakdownWithProjection(
      transactions,
      recurringTemplates,
      year,
      month,
      view,
      false,
    ),
    investmentDeploymentBreakdown:
      buildBudgetInvestmentBreakdownWithProjection(
        transactions,
        recurringTemplates,
        year,
        month,
        view,
        true,
      ),
  };
}
