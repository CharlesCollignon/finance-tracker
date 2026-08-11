import type { CategoryType } from "./types/database";

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  income: "Income",
  expense: "Expense",
  savings: "Savings",
  investment: "Investment",
};

export const CATEGORY_TYPE_BADGE_CLASS: Record<CategoryType, string> = {
  income: "bg-success/15 text-success",
  expense: "bg-destructive/15 text-destructive",
  savings: "bg-primary/15 text-primary",
  investment: "bg-info/15 text-info",
};

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** Semantic allocation colors for Sankey / pies. */
export const ALLOCATION_COLORS = {
  income: "var(--success)",
  expenses: "var(--destructive)",
  savings: "var(--primary)",
  investments: "var(--info)",
  remaining: "var(--chart-5)",
} as const;

export const TYPE_AMOUNT_CLASS: Record<CategoryType, string> = {
  income: "text-success",
  expense: "text-destructive",
  savings: "text-primary",
  investment: "text-info",
};
