import type { Locale } from "@finance/core/i18n/locale";
import { landingSampleFr } from "@/components/marketing/landing-sample.fr";
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
  /**
   * A read of the month above.
   *
   * The prose is written for this page; every figure quoted in it is one of
   * the numbers already in this file, which is the whole point being
   * illustrated — the writer names a figure and the app substitutes its own
   * value. Kept short: the real thing is a paragraph and a few lines, not an
   * essay.
   */
  read: {
    writtenOn: "19 March",
    headline:
      "March is holding, and the part that is not is the part you did not record.",
    observations: [
      {
        tone: "good" as const,
        text: "You have €1,247 left with twelve days to go, which is ahead of where February sat on the same day.",
      },
      {
        tone: "bad" as const,
        text: "February's unrecorded spending came to €218 — inside your €260 allowance, but it is the largest line you have no rows for.",
      },
      {
        tone: "flat" as const,
        text: "Housing, at €850, is unchanged for the fourth month and is now 44% of what you spend.",
      },
    ],
    suggestions: [
      "Groceries has been under its €600 cap every month since December. A lower cap would tell you something the current one cannot.",
    ],
    standing: "Written today. Nothing has moved since.",
  },

  /** Where the month's spending went, largest first. Sums to `spent`. */
  spendByCategory: [
    { label: "Housing", amount: 850, colorVar: "--chart-1" },
    { label: "Investments", amount: 400, colorVar: "--chart-4" },
    { label: "Savings", amount: 300, colorVar: "--chart-3" },
    { label: "Groceries", amount: 218, colorVar: "--chart-2" },
    { label: "Everything else", amount: 185, colorVar: "--chart-5" },
  ],
};

/* --------------------------------------------------------------- languages */

/**
 * The sample month in one language.
 *
 * The figures come from `landingSample` in both, and only the words are
 * swapped. Written out as explicit spreads rather than a generic deep merge:
 * there are thirty-odd fields and the arrays have to stay index-aligned with
 * the numbers beside them, which a clever recursion would hide and a plain
 * list of assignments cannot.
 */
export function landingSampleFor(locale: Locale) {
  if (locale === "en") {
    return landingSample;
  }

  const fr = landingSampleFr;
  return {
    ...landingSample,
    monthLabel: fr.monthLabel,
    onBudgetLabel: fr.onBudgetLabel,
    budget: { ...landingSample.budget, label: fr.budgetLabel },
    goal: {
      ...landingSample.goal,
      label: fr.goalLabel,
      targetLabel: fr.goalTargetLabel,
    },
    transactions: landingSample.transactions.map((row, index) => ({
      ...row,
      ...fr.transactions[index],
    })),
    templates: landingSample.templates.map((row, index) => ({
      ...row,
      ...fr.recurring[index],
    })),
    close: { ...landingSample.close, ...fr.close },
    read: {
      ...landingSample.read,
      writtenOn: fr.read.writtenOn,
      headline: fr.read.headline,
      observations: landingSample.read.observations.map((row, index) => ({
        ...row,
        text: fr.read.observations[index] ?? row.text,
      })),
      suggestions: fr.read.suggestions,
      standing: fr.read.standing,
    },
    spendByCategory: landingSample.spendByCategory.map((row, index) => ({
      ...row,
      label: fr.spendByCategory[index] ?? row.label,
    })),
  };
}

/** The shape both languages present. */
export type LocalisedLandingSample = typeof landingSample;
