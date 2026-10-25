/**
 * The Plan page: where the money is heading, the milestones on the way, the
 * cushion, the long view with French taxes, and the run of month-ends. One
 * set of words for the web and the phone; `en.ts` mounts it as `futurePlan`.
 */
export const futurePlanEn = {
  scrubPoint: "{month}: {amount}",
  inYearsTitle: { one: "A year from now", other: "{count} years from now" },
  accountCurrent: "Current account",
  accountElsewhere: "Other savings",

  /* What if, aimed */
  whatIfTo: "Into",
  whatIfToLabel: "Where the extra goes",

  /* What if */
  whatIfTitle: "What if…",
  whatIfLabel: "Put aside more each month",
  whatIfPerMonth: "+{amount} a month",
  whatIfNone: "Slide to see what a little more each month changes.",
  whatIfSooner: {
    one: "{milestone} reached {count} month sooner",
    other: "{milestone} reached {count} months sooner",
  },
  whatIfNowReached: "{milestone} reached in {month}",
  milestoneBeyond: "beyond {count} years",
  milestoneNew: "New milestone!",
  cushionMonths: { one: "{count} month", other: "{count} months" },
  cushionNext: "Next step: {months}",
  cushionFull: "Six months covered: your cushion is complete.",
  cushionNoFixed:
    "Add your fixed costs in Recurring and your cushion will be measured here.",
  years: { one: "{count} year", other: "{count} years" },
  today: "Today",
  accountsReset: "Back to my figures",
  fieldInitial: "In it today",
  fieldMonthly: "Each month",
  fieldReturn: "Return per year",
  fieldFees: "Fees per year",
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

  /* The run and the months */
  runTitle: "Your run",
  runCount: {
    one: "{count} month in a row",
    other: "{count} months in a row",
  },
  runRecord: { one: "Best: {count} month", other: "Best: {count} months" },
  runKeep: "Wrap up {month} to keep it going",
  monthsTitle: "Your months",
  monthsBest: "Best month: {month}, {amount} saved",
  monthsEmpty: "Wrap up your first month to see your months here.",
};
