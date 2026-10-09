import type { Locale } from "@finance/core/i18n/locale";
// Relative, where the rest of this tree writes `@/components/...`. The two
// `@finance/core` imports above are erased as types, so this is the module's
// only runtime edge, and keeping it a sibling path is what lets a test runner
// load the file with no knowledge of the app's `@` alias. The French words
// and the figures they belong to are one unit; a path that says so is not a
// worse path.
import { landingSampleFr } from "./landing-sample.fr";
import type { CategoryType } from "@finance/core/types/database";

/**
 * How often a recurring template fires, as something the code can branch on.
 *
 * Deliberately not the word printed on screen: that word is translated, and a
 * comparison against a translated word is a comparison that stops being true
 * as soon as somebody reads the page in French.
 */
export type Cadence = "monthly" | "weekly";

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
  /** The Plan page: a year ahead, the milestones on the way, the cushion. */
  plan: {
    yearAhead: 14850,
    byLabel: "March 2027",
    milestones: [
      { amount: 5000, monthsAway: 0 },
      { amount: 10000, monthsAway: 4 },
      { amount: 25000, monthsAway: 26 },
    ],
    /** Months of fixed costs the savings cover, out of the six to aim for. */
    cushionMonths: 3,
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
  /**
   * `id` and `cadence` are the language-neutral halves of a template; `name`
   * and `schedule` are the words. The split is not decoration: the mock
   * weights a weekly template by 4.33 to reach a monthly figure, and it used
   * to do that by comparing the displayed frequency to `"Weekly"` — which is
   * false in every language but English, so the French expected-impact figure
   * was quietly wrong. Anything the mock branches on lives in `id` or
   * `cadence`; anything it prints lives in `name` or `schedule` and has a
   * French counterpart in `./landing-sample.fr`.
   */
  templates: [
    {
      id: "salary",
      name: "Salary",
      schedule: "Monthly · day 3",
      cadence: "monthly" as Cadence,
      amount: 3200,
      type: "income" as CategoryType,
    },
    {
      id: "rent",
      name: "Rent",
      schedule: "Monthly · day 5",
      cadence: "monthly" as Cadence,
      amount: -850,
      type: "expense" as CategoryType,
    },
    {
      id: "pea-dca",
      name: "PEA DCA",
      schedule: "Weekly · Friday",
      cadence: "weekly" as Cadence,
      amount: -50,
      type: "investment" as CategoryType,
    },
    {
      id: "netflix",
      name: "Netflix",
      schedule: "Monthly · day 15",
      cadence: "monthly" as Cadence,
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
   * The Bearing's own figures, on the 19th of the sample month.
   *
   * They have to agree with the rest of this file or the mock states two
   * different months at once: `netPosition` is `onHand` plus `portfolio`,
   * and `free` is `onHand` less `committed` plus `arriving`, which is the
   * arithmetic `month-pulse.ts` does. Change one and change the others.
   *
   * There is no `streak` here — `close.streak` already holds it, and the Run
   * card states the same run the close history does.
   */
  bearing: {
    onHand: 2410,
    committed: 620,
    arriving: 240,
    free: 2030,
    savingsRate: 18,
    netPosition: 14890,
    unrecordedBaseline: 232,
    projectedBalance: 3640,
  },
  /**
   * The forward projection's two tracks, over a year.
   *
   * `accountsEnd` is the same figure the Bearing's "year ahead" card leads
   * with, and `keptEnd` is it plus twelve months of `setAsideMonthly` — the
   * gap between the two lines is exactly what has been put by, which is the
   * whole reason there are two of them.
   */
  projection: {
    setAsideMonthly: 500,
    accountsEnd: 3640,
    keptEnd: 9640,
  },
  /**
   * The close of the month before this one — February, read on the reading
   * day in March. Deliberately a reconciled close rather than a baseline:
   * a baseline has nothing to show, and the whole point of the section it
   * feeds is the figure a baseline cannot produce yet.
   *
   * February's own flows, and that is the correction rather than a detail.
   * The close panel used to draw its two middle rows from `income` and
   * `spent` at the top of this file, which are March's and which March is
   * nineteen days into: the panel headed "How it adds up" added up to
   * €5,427 beside a closing balance of €4,906, under a headline claiming
   * €218 of unrecorded spending. A panel that promises to show the
   * arithmetic disproved the figure it was there to prove.
   *
   * The names below are the domain's. `recordedIn` is `flows.income`,
   * `recordedOut` is what `recordedOutflow()` returns — expenses at face
   * value, plus what was set aside, plus what left for a broker — and
   * `setAside` is the savings-and-transfers part of that outflow, which is
   * the part that stayed the reader's money and so the part `kept` adds
   * back. Every derived figure follows from them by the arithmetic
   * `buildMonthClose` does, and `landing-sample.test.ts` runs the real
   * function over these inputs and asserts each one:
   *
   *   unrecorded = opening + in − out − closing = 4180 + 3200 − 2256 − 4906
   *   kept       = (closing − opening) + setAside = 726 + 350
   *   keptRate   = kept / in = 1076 / 3200
   *
   * `recordedIn` is 3,200 because the salary template pays that every month
   * and is the only income there is — February's own figure, which happens
   * to equal March's rather than being borrowed from it. `recordedOut` is a
   * whole month where March's 1,953 is nineteen days of one, and `setAside`
   * is 150 to the emergency fund plus four Friday DCAs of 50, which is what
   * February held.
   */
  close: {
    monthLabel: "February 2026",
    readingDay: "the 8th",
    openingBalance: 4180,
    recordedIn: 3200,
    recordedOut: 2256,
    setAside: 350,
    closingBalance: 4906,
    unrecorded: 218,
    unrecordedCap: 260,
    kept: 1076,
    keptRate: 33.6,
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
        text: "You are €1,247 up on the month with twelve days to go, ahead of where February sat on the same day.",
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
      "Groceries are at €218 with twelve days to go. Writing down the small shops this week would show whether the unrecorded line is groceries too.",
    ],
    standing: "Written today. Nothing has moved since.",
  },

  /**
   * « Il vous reste » on the 19th: the accounts (`bearing.onHand`), less the
   * charges still due before the salary on 3 April (`bearing.committed`),
   * less the margin's share of those fifteen days — 2,410 − 620 − 140 =
   * 1,650, and 1,650 over the fifteen days to the 2nd is 110 a day.
   */
  leftToSpend: {
    balance: 2410,
    charges: 620,
    marge: 140,
    amount: 1650,
    perDay: 110,
    through: "2026-04-02",
  },

  /**
   * One exchange in « Questions ». The answer's figures are chips the app
   * puts in, as the real feature does: `spent` is the groceries figure the
   * read below quotes, `before` February's by the same day.
   */
  questions: {
    question: "How much did I spend on groceries this month?",
    answer: [
      "Groceries come to {spent} so far in March.",
      "By the same day in February, it was {before}.",
    ],
    figures: { spent: 218, before: 241 },
  },

  /**
   * The shared space of the sample couple: the joint account, the share
   * they set, and its month's rows with the initial of who added each.
   * `myPart` is half of `spent`, as `share` says.
   */
  together: {
    name: "Shared",
    me: "Me",
    balance: 1340,
    share: 50,
    spent: 1120,
    myPart: 560,
    rows: [
      { name: "Monoprix", meta: "Groceries", amount: -86.4, by: "A" },
      { name: "Free", meta: "Internet", amount: -29.99, by: "B" },
      { name: "Le Bistrot", meta: "Restaurants", amount: -54, by: "A" },
      { name: "From B.", meta: "Transfer", amount: 600, by: "B" },
    ],
  },

  /**
   * The tax page for 2025, filed in 2026: the boxes the sample year fills.
   * 5NI is the studio's year of rent, twelve months of `property.monthly`.
   */
  tax: {
    year: 2025,
    boxes: [
      { id: "7UF", label: "Donations", amount: 240 },
      { id: "7DB", label: "Home help", amount: 1860 },
      { id: "5NI", label: "Furnished let, receipts", amount: 8280 },
    ],
  },

  /**
   * Immobilier: a studio the sample person lets — they rent their own home,
   * as the ledger's « Loyer » says. Net value is `value` less `owed`.
   */
  property: {
    name: "Studio, Lyon 7e",
    kindLine: "Apartment · Furnished let · 24 m²",
    value: 168000,
    low: 159000,
    high: 177000,
    owed: 112400,
    monthly: 690,
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
    plan: { ...landingSample.plan, byLabel: fr.planByLabel },
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
    property: { ...landingSample.property, ...fr.property },
    questions: { ...landingSample.questions, ...fr.questions },
    together: {
      ...landingSample.together,
      name: fr.together.name,
      me: fr.together.me,
      rows: landingSample.together.rows.map((row, index) => ({
        ...row,
        ...fr.together.rows[index],
      })),
    },
    tax: {
      ...landingSample.tax,
      boxes: landingSample.tax.boxes.map((box, index) => ({
        ...box,
        label: fr.tax[index] ?? box.label,
      })),
    },
    spendByCategory: landingSample.spendByCategory.map((row, index) => ({
      ...row,
      label: fr.spendByCategory[index] ?? row.label,
    })),
  };
}

/** The shape both languages present. */
export type LocalisedLandingSample = typeof landingSample;
