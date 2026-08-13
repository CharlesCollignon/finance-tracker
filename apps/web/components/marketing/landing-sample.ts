import type { CategoryType } from "@finance/core/types/database";

export const landingSample = {
  monthLabel: "March",
  remaining: 1247,
  income: 3200,
  spent: 1953,
  onBudgetLabel: "On budget",
  budget: {
    label: "Groceries",
    spent: 420,
    limit: 600,
  },
  goal: {
    label: "Emergency fund",
    saved: 1800,
    target: 3000,
  },
  templates: [
    { name: "Salary", amount: 3200, type: "income" as CategoryType },
    { name: "Rent", amount: -850, type: "expense" as CategoryType },
    { name: "PEA DCA", amount: -200, type: "investment" as CategoryType },
  ],
  calendarDays: [
    { day: 1, amount: -12 },
    { day: 2, amount: null },
    { day: 3, amount: 3200 },
    { day: 4, amount: null },
    { day: 5, amount: -850 },
    { day: 6, amount: null },
    { day: 7, amount: null },
    { day: 8, amount: -42 },
    { day: 9, amount: null },
    { day: 10, amount: null },
    { day: 11, amount: null },
    { day: 12, amount: -200 },
    { day: 13, amount: null },
    { day: 14, amount: null },
  ],
  portfolio: 12480,
  portfolioInvested: 11000,
} as const;
