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
  /** Everything recorded leaving in March so far — what the Journal's « Sorties » adds up. */
  spent: 1953,
  /**
   * The part of `spent` that is spending: the expenses alone, without what
   * went to savings and the PEA — what « Dépensé » and « Où c'est parti »
   * count. `spendByCategory` sums to it.
   */
  expenses: 1453,
  /** The Plan page: a year ahead, the milestones on the way, the cushion. */
  plan: {
    byLabel: "March 2027",
    milestones: [
      { amount: 5000, monthsAway: 0 },
      { amount: 10000, monthsAway: 4 },
      { amount: 25000, monthsAway: 26 },
    ],
    /** Months of fixed costs the savings cover, out of the six to aim for. */
    cushionMonths: 3,
    /**
     * What the milestones are measured on today — the savings and what the
     * DCA has put by, with their return — so the next one is four months off.
     */
    towards: 8600,
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
      day: 13,
      dayLabel: "13 Mar",
      icon: "chart-line",
      amount: -50,
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
  /** How many rows March holds so far: `transactions` are the latest few. */
  entries: 23,
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
    {
      id: "emergency-fund",
      name: "Emergency fund",
      schedule: "Monthly · day 12",
      cadence: "monthly" as Cadence,
      amount: -150,
      type: "savings" as CategoryType,
    },
    {
      id: "internet",
      name: "Internet",
      schedule: "Monthly · day 10",
      cadence: "monthly" as Cadence,
      amount: -30,
      type: "expense" as CategoryType,
    },
    {
      id: "health",
      name: "Health insurance",
      schedule: "Monthly · day 25",
      cadence: "monthly" as Cadence,
      amount: -64,
      type: "expense" as CategoryType,
    },
  ],
  /**
   * What the templates come to in March, as `rollUpRecurring` sums them: the
   * DCA's four Fridays make 200 €, and what is left each month is the income
   * less the other three.
   */
  rollup: {
    income: 3200,
    expense: 959,
    savings: 150,
    investment: 200,
    left: 1891,
  },
  /**
   * Placements: the three wallets the sample person keeps, each worth
   * `value` for `invested` paid in. They sum to `portfolio` and
   * `portfolioInvested`, and their gains to `portfolioGain`.
   */
  wallets: [
    { id: "pea" as const, value: 6800, invested: 6000 },
    { id: "cto" as const, value: 4200, invested: 3800 },
    { id: "crypto" as const, value: 1480, invested: 1200 },
  ],
  /**
   * The PEA, open on Placements. Its lines sum to its row in `wallets`; each
   * carries its price over the year, a point a month, for the sparkline, and
   * `change` is that line's last point against its first. `openedOn` starts
   * the five-year clock, and `monthly` is what the PEA DCA in `templates`
   * sends it in March: 50 € on each of the month's four Fridays.
   */
  pea: {
    openedOn: "2022-06-14",
    monthly: 200,
    positions: [
      {
        name: "MSCI World ETF",
        symbol: "CW8.PA",
        value: 4120,
        invested: 3600,
        change: 11.2,
        trend: [
          100, 102.1, 101.4, 104.2, 103.1, 105.8, 107.2, 106.1, 108.4, 109.9,
          108.7, 110.3, 111.2,
        ],
      },
      {
        name: "S&P 500 ETF",
        symbol: "PSP5.PA",
        value: 1910,
        invested: 1700,
        change: 13.6,
        trend: [
          100, 101.8, 103.5, 101.2, 104.6, 106.9, 105.3, 108.1, 110.2, 109.4,
          111.8, 112.9, 113.6,
        ],
      },
      {
        name: "Emerging markets ETF",
        symbol: "PAEEM.PA",
        value: 770,
        invested: 700,
        change: 4.1,
        trend: [
          100, 98.6, 99.9, 101.7, 100.4, 98.9, 100.8, 102.6, 101.5, 103.2,
          102.4, 103.6, 104.1,
        ],
      },
    ],
  },
  /** The crypto wallet, in bitcoin: its 1,480 € at 80,000 € a coin. */
  btc: 0.0185,
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
   * Le point's balance card and the two cards under it, on the 19th.
   *
   * `curve` is the current account day by day, a `[day, balance]` pair
   * where it moves: 1,180 € on the 1st, the salary on the 3rd, then down to
   * `bearing.onHand` today, and planned from tomorrow to `bearing.free` on
   * the 31st — `leaving` (the 620 € of `bearing.committed`) going out and
   * `arriving` (`bearing.arriving`) coming in. `upcoming` is the first four
   * of what leaves, and `upcomingMore` the rest of it: together they come to
   * `leaving`. `lowest` is the curve's lowest planned point.
   *
   * `spentTrend` is six months of spending, March so far last, which is
   * `expenses`; `spentBefore` is February's spending on the same day.
   */
  bearingMonth: {
    curve: [
      [1, 1180],
      [2, 1180],
      [3, 4380],
      [5, 3530],
      [7, 3466],
      [8, 3402],
      [10, 3290],
      [12, 3140],
      [13, 3090],
      [15, 2975],
      [17, 2730],
      [19, 2410],
      [20, 2360],
      [22, 2210],
      [25, 2146],
      [27, 2096],
      [28, 1790],
      [30, 2030],
      [31, 2030],
    ] as [number, number][],
    lowest: { day: 28, value: 1790 },
    arriving: 240,
    leaving: 620,
    upcoming: [
      {
        day: 20,
        name: "PEA DCA",
        amount: 50,
        type: "investment" as CategoryType,
      },
      {
        day: 22,
        name: "Livret A",
        amount: 150,
        type: "savings" as CategoryType,
      },
      {
        day: 25,
        name: "Health insurance",
        amount: 64,
        type: "expense" as CategoryType,
      },
      {
        day: 27,
        name: "PEA DCA",
        amount: 50,
        type: "investment" as CategoryType,
      },
    ],
    upcomingMore: 1,
    spentTrend: [
      { month: 10, total: 1640 },
      { month: 11, total: 1520 },
      { month: 12, total: 1890 },
      { month: 1, total: 1550 },
      { month: 2, total: 1706 },
      { month: 3, total: 1453 },
    ],
    spentBefore: 1580,
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
        text: "Housing, at €850, is unchanged for the fourth month and is now 59% of what you spend.",
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
    exchanges: [
      {
        question: "How much did I spend on groceries this month?",
        answer: [
          "Groceries come to {spent} so far in March.",
          "By the same day in February, it was {before}.",
        ],
      },
      {
        question: "What is my biggest subscription?",
        answer: ["Netflix, at {netflix} a month — the only one you have."],
      },
    ],
    figures: { spent: 218, before: 241, netflix: 15 },
  },

  /**
   * The shared space of the sample couple: the joint account, the share
   * they set, and its month's rows with the initial of who added each.
   * `myPart` is half of `spent`, as `share` says.
   */
  together: {
    name: "Shared",
    me: "Me",
    /** The two of them, by initial: the sample person first. */
    members: ["A", "B"],
    balance: 1340,
    share: 50,
    spent: 1120,
    myPart: 560,
    rows: [
      {
        day: 18,
        name: "Monoprix",
        meta: "Groceries",
        icon: "shopping-cart",
        type: "expense" as CategoryType,
        amount: -86.4,
        by: "A",
      },
      {
        day: 17,
        name: "Free",
        meta: "Internet",
        icon: "wifi",
        type: "expense" as CategoryType,
        amount: -29.99,
        by: "B",
      },
      {
        day: 14,
        name: "Le Bistrot",
        meta: "Restaurants",
        icon: "credit-card",
        type: "expense" as CategoryType,
        amount: -54,
        by: "A",
      },
      {
        day: 1,
        name: "From B.",
        meta: "Transfer",
        icon: "bank",
        type: "income" as CategoryType,
        amount: 600,
        by: "B",
      },
      {
        day: 1,
        name: "From A.",
        meta: "Transfer",
        icon: "bank",
        type: "income" as CategoryType,
        amount: 600,
        by: "A",
      },
    ],
    /** What came into the joint account this month — the two transfers — and how many rows it holds. */
    income: 1200,
    entries: 14,
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
    postcode: "69007",
    /** What it cost: the price paid and the costs of buying it. */
    cost: 152000,
    /** The loan's first figure, of which `owed` is still to repay. */
    borrowed: 130000,
    /** The sales the estimate rests on, as the property page cites them. */
    market: {
      sales: 38,
      periodFrom: "2023-01-01",
      periodTo: "2025-12-31",
      quarter: "2026-Q1",
      medianM2: 7000,
      lowM2: 6625,
      highM2: 7375,
    },
  },

  /** Where the month's spending went, largest first. Sums to `expenses`. */
  spendByCategory: [
    { label: "Housing", icon: "house", amount: 850, colorVar: "--chart-1" },
    {
      label: "Groceries",
      icon: "shopping-cart",
      amount: 218,
      colorVar: "--chart-2",
    },
    { label: "Transport", icon: "car", amount: 86, colorVar: "--chart-3" },
    {
      label: "Utilities",
      icon: "lightning",
      amount: 65,
      colorVar: "--chart-4",
    },
    {
      label: "Everything else",
      icon: "dots-three",
      amount: 234,
      colorVar: "--chart-5",
    },
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
    bearingMonth: {
      ...landingSample.bearingMonth,
      upcoming: landingSample.bearingMonth.upcoming.map((row, index) => ({
        ...row,
        name: fr.upcoming[index] ?? row.name,
      })),
    },
    pea: {
      ...landingSample.pea,
      positions: landingSample.pea.positions.map((row, index) => ({
        ...row,
        name: fr.peaPositions[index] ?? row.name,
      })),
    },
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
    spendByCategory: landingSample.spendByCategory.map((row, index) => ({
      ...row,
      label: fr.spendByCategory[index] ?? row.label,
    })),
  };
}
