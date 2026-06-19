import type { CategoryType } from "@/lib/types/database";

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  income: "Income",
  expense: "Expense",
  savings: "Savings",
  investment: "Investment",
};

export const CATEGORY_TYPE_BADGE_CLASS: Record<CategoryType, string> = {
  income: "bg-[var(--chart-1)] text-foreground",
  expense: "bg-[var(--chart-2)] text-destructive-foreground",
  savings: "bg-[var(--chart-3)] text-background",
  investment: "bg-[var(--chart-4)] text-background",
};

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const ALLOCATION_COLORS = {
  expenses: "var(--chart-2)",
  savings: "var(--chart-3)",
  investments: "var(--chart-4)",
  remaining: "var(--chart-1)",
} as const;

export const TYPE_AMOUNT_CLASS: Record<CategoryType, string> = {
  income: "text-[var(--chart-4)]",
  expense: "text-destructive",
  savings: "text-[var(--chart-5)]",
  investment: "text-[var(--chart-5)]",
};
