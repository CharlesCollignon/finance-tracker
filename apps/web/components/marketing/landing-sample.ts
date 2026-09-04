import type { CategoryType } from "@finance/core/types/database";

/** A realistic month of made-up data, reused consistently across every
 * feature mock so the numbers agree with each other (the calendar's dots
 * are the same rows as the transaction list, etc). Year/month are fixed so
 * the calendar grid renders identically regardless of when this is viewed. */
export const landingSample = {
  monthLabel: "March 2026",
  year: 2026,
  month: 3,
  remaining: 1247,
  income: 3200,
  spent: 1953,
  onBudgetLabel: "On track",
  budget: {
    label: "Groceries",
    spent: 420,
    limit: 600,
  },
  goal: {
    label: "Emergency fund",
    saved: 1800,
    target: 3000,
    targetLabel: "December 2026",
    monthlyPace: 133,
  },
  transactions: [
    {
      name: "Acme Corp",
      meta: "Salary",
      day: 3,
      dayLabel: "3 Mar",
      icon: "wallet",
      amount: 3200,
      type: "income" as CategoryType,
    },
    {
      name: "Landlord",
      meta: "Rent",
      day: 5,
      dayLabel: "5 Mar",
      icon: "house",
      amount: -850,
      type: "expense" as CategoryType,
    },
    {
      name: "Carrefour",
      meta: "Groceries",
      day: 8,
      dayLabel: "8 Mar",
      icon: "shopping-cart",
      amount: -64.2,
      type: "expense" as CategoryType,
    },
    {
      name: "Emergency fund",
      meta: "Savings",
      day: 12,
      dayLabel: "12 Mar",
      icon: "piggy-bank",
      amount: -150,
      type: "savings" as CategoryType,
    },
    {
      name: "PEA DCA",
      meta: "Investments",
      day: 15,
      dayLabel: "15 Mar",
      icon: "chart-line",
      amount: -200,
      type: "investment" as CategoryType,
    },
    {
      name: "Électricité",
      meta: "Utilities",
      day: 19,
      dayLabel: "Today",
      icon: "lightning",
      amount: -64.8,
      type: "expense" as CategoryType,
    },
  ],
  today: 19,
  templates: [
    {
      name: "Salary",
      frequency: "Monthly",
      amount: 3200,
      type: "income" as CategoryType,
    },
    {
      name: "Rent",
      frequency: "Monthly",
      amount: -850,
      type: "expense" as CategoryType,
    },
    {
      name: "PEA DCA",
      frequency: "Weekly",
      amount: -50,
      type: "investment" as CategoryType,
    },
    {
      name: "Netflix",
      frequency: "Monthly",
      amount: -15,
      type: "expense" as CategoryType,
    },
  ],
  wallets: [
    { label: "PEA", value: 6800, colorVar: "--chart-1" },
    { label: "CTO", value: 4200, colorVar: "--chart-2" },
    { label: "Crypto", value: 1480, colorVar: "--chart-3" },
  ],
  portfolio: 12480,
  portfolioInvested: 11000,
  portfolioGain: 1480,
  /**
   * The close of the month before this one — February, read on the reading
   * day in March. Deliberately a reconciled close rather than a baseline:
   * a baseline has nothing to show, and the whole point of the section it
   * feeds is the figure a baseline cannot produce yet.
   */
  close: {
    monthLabel: "February 2026",
    readingDay: "the 8th",
    openingBalance: 4180,
    closingBalance: 4906,
    unrecorded: 218,
    unrecordedCap: 260,
    kept: 1142,
    keptRate: 35.7,
    streak: 4,
  },
  /** Where the month's spending went, largest first. Sums to `spent`. */
  spendByCategory: [
    { label: "Housing", amount: 850, colorVar: "--chart-1" },
    { label: "Investments", amount: 400, colorVar: "--chart-4" },
    { label: "Savings", amount: 300, colorVar: "--chart-3" },
    { label: "Groceries", amount: 218, colorVar: "--chart-2" },
    { label: "Everything else", amount: 185, colorVar: "--chart-5" },
  ],
} as const;
