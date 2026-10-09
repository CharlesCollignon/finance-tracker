/**
 * The Plan page: where the money is heading, the milestones on the way, the
 * cushion, the long view with French taxes, and the run of month-ends. One
 * set of words for the web and the phone; `en.ts` mounts it as `futurePlan`.
 */
export const futurePlanEn = {
  intro: "Where your money is heading, if things carry on as they are.",
  estimate: "An estimate from your own figures — not advice.",

  /* A year from now */
  yearTitle: "A year from now",
  yearGrounded: "in your accounts and put aside, by {month}",
  yearAdded: "put aside by {month}, on top of what you have today",
  scrubHint: "Drag across the curve to see each month",
  scrubPoint: "{month}: {amount}",
  scrubWithExtra: "{amount} with the extra",

  /* The year ahead, account by account */
  inMonthsTitle: "In {count} months",
  inYearsTitle: { one: "A year from now", other: "{count} years from now" },
  horizonMonths: "{count} months",
  yearAllGrounded: "across all your accounts, by {month}",
  yearAllAdded:
    "in your savings and investments by {month}, plus what the months leave on your current account",
  yearShownOnly: "in the accounts shown, by {month}",
  accountCurrent: "Current account",
  accountElsewhere: "Other savings",
  accountsPending: "Investments…",
  accountToggle: "Show or hide {name}",
  currentNoBank:
    "With no bank connected, the current account starts at zero: it shows what the months add to it.",
  elsewhereHint:
    "Put aside from the current account with no account of yours receiving it, like the margin left at a broker above the purchases it pays for.",

  /* Why */
  whyLeadIncome: "Each month, out of {amount} coming in",
  flowGrowthLine: "Plus {amount} of interest and estimated returns by {month}.",
  eventAdd: "An event",
  detailsLabel: "The details",
  whyTitle: "Why",
  flowCommitted: "Fixed costs",
  flowEveryday: "Everyday spending",
  flowEverydayUnmeasured:
    "Everyday spending isn't measured yet. Wrap up a few months and it will be taken off here.",
  flowCurrentStays: "Stays on the current account",
  flowCurrentFalls: "Comes out of the current account",

  /* What if, aimed */
  whatIfTo: "Into",
  whatIfToLabel: "Where the extra goes",
  whatIfResultBy: "{amount} more by {month}",
  whatIfClear: "Clear all",

  /* Events */
  eventsHint: "Drag a marker along the curve to change its month.",
  eventRaise: "A raise",
  eventBonus: "A bonus",
  eventExpense: "A big expense",
  eventRaiseLine: "+{amount} a month from {month}",
  eventBonusLine: "+{amount} in {month}",
  eventExpenseLine: "−{amount} in {month}",
  eventRaiseAmount: "More each month",
  eventAmount: "Amount",
  eventMonth: "Month",
  eventRemove: "Remove {name}",
  eventBeyond: "beyond the horizon",
  eventMarker: "{name}, {line}. Left and right arrows change the month.",

  /* What if */
  whatIfTitle: "What if…",
  whatIfLabel: "Put aside more each month",
  whatIfPerMonth: "+{amount} a month",
  whatIfNone: "Slide to see what a little more each month changes.",
  whatIfResult: "{amount} more in a year",
  whatIfSooner: {
    one: "{milestone} reached {count} month sooner",
    other: "{milestone} reached {count} months sooner",
  },
  whatIfNowReached: "{milestone} reached in {month}",

  /* Milestones */
  milestonesTitle: "Your milestones",
  milestonesBasis: "Your savings and investments, growing at their return",
  milestoneReached: "Reached",
  milestoneIn: { one: "in {count} month", other: "in {count} months" },
  milestoneOn: "in {month}",
  milestoneBeyond: "beyond {count} years",
  milestoneNew: "New milestone!",

  /* Cushion */
  cushionTitle: "Your safety cushion",
  cushionBody: "{months} of fixed costs covered by your savings",
  cushionMonths: { one: "{count} month", other: "{count} months" },
  cushionNext: "Next step: {months}",
  cushionFull: "Six months covered: your cushion is complete.",
  cushionNoFixed:
    "Add your fixed costs in Recurring and your cushion will be measured here.",
  cushionWhy:
    "Three to six months of fixed costs put aside is the usual safety net for a job loss or a big repair.",

  /* The long view */
  longTitle: {
    one: "Your wealth in {count} year",
    other: "Your wealth in {count} years",
  },
  longNet: "after tax",
  longReal: "that is {amount} in today's euros",
  longIncome: "an income of about {amount} a month",
  longIncomeHint:
    "What you could take out each month at the withdrawal rate, in today's euros.",
  legendInitial: "Already there",
  legendContributions: "Your payments",
  legendGains: "Gains after tax",
  statFuture: "Future value",
  statGains: "Of which gains",
  statTaxes: "Estimated tax",
  statNet: "Net value",
  horizon: "Horizon",
  years: { one: "{count} year", other: "{count} years" },
  today: "Today",
  inYears: { one: "in {count} year", other: "in {count} years" },
  inflation: "Inflation",
  inflationHint: "How fast prices rise each year. 2% is the European target.",
  withdrawalRate: "Withdrawal rate",
  withdrawalHint:
    "The share of your wealth you would take out each year to live on. 4% is the usual rule of thumb.",
  accountsTitle: "Your accounts",
  accountsFromData: "Filled in from your investments and recurring payments.",
  accountsReset: "Back to my figures",
  accountAdd: "Add an account",
  accountRemove: "Remove {name}",
  fieldInitial: "In it today",
  fieldMonthly: "Each month",
  fieldReturn: "Return per year",
  fieldTax: "Tax on gains",
  envelopeLivret: "Savings accounts (Livret A, LDDS, LEP)",
  taxPea: "18.6% social contributions on gains after 5 years (31.4% before).",
  taxCto: "31.4% flat tax: 12.8% income tax and 18.6% social contributions.",
  taxAv:
    "24.7% after 8 years, on gains above €4,600 a year (€9,200 for a couple).",
  taxPer:
    "31.4% on gains; the payments you deducted are taxed as income when you take them out.",
  taxCrypto: "31.4% flat tax, on sales above €305 a year.",
  taxLivret: "None: the Livret A, LDDS and LEP are tax-free.",
  taxSource: "2026 rates, simplified to one rate per account.",

  /* The run and the months */
  runTitle: "Your run",
  runCount: {
    one: "{count} month in a row",
    other: "{count} months in a row",
  },
  runRecord: { one: "Best: {count} month", other: "Best: {count} months" },
  runKeep: "Wrap up {month} to keep it going",
  runStart: "Wrap up a month inside your allowance to start a run.",
  monthsTitle: "Your months",
  monthsBest: "Best month: {month}, {amount} saved",
  monthsEmpty: "Wrap up your first month to see your months here.",
};
