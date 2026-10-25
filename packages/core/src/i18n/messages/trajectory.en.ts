/**
 * The Plan's words since October 2026: the trajectory replayed on market
 * history, « Face à l'histoire », « Progression » and « Hypothèses ».
 * Mounted by `en.ts` as `trajectory`; `trajectory.fr.ts` is its French half.
 */
export const trajectoryEn = {
  intro:
    "Where your accounts could go, replayed on what markets actually did since 1970.",

  title: "Your trajectory",
  horizonLabel: "Horizon",
  medianCaption: "in today’s euros, from the middle start since 1970",
  rangeLine: "8 starts in 10 since 1970: between {low} and {high}",
  worstLine: "Worst start: {month}, {amount}",
  afterTax: "about {amount} after tax if you sold everything",
  scrubPoint: "{when}: {median}, between {low} and {high}",
  scrubYears: { one: "In {count} year", other: "In {count} years" },
  scrubMonths: { one: "In {count} month", other: "In {count} months" },
  withProperty: "With your homes",
  withPropertyHint:
    "Their estimated net value, as a line: no market history speaks for a home.",
  whatIfResult: "{amount} more by {year}",
  chartLabel:
    "Your accounts, start by start since 1970: the middle line, and the band 8 starts in 10 end in",

  whyTitle: "Where this comes from",
  accountLine: "{today} today → {then}",
  follows: "Follows {series}",
  followsMix: "Follows {first}, and {rest}",
  lossLine:
    "Over {years} years, ended below prices {count} times in 100 since {since}",
  lossNever: "Over {years} years, never ended below prices since {since}",
  standIn:
    "{share} of it follows a neighbouring series: emerging markets and the Nasdaq have no open history of their own.",
  unknown: "{share} the app does not recognise, followed as {series}.",
  cryptoFlat:
    "Bitcoin has only eleven years of history: the trajectory holds it at today’s value, in constant euros.",
  currentLine:
    "What stays on the current account earns nothing: in today’s euros, it loses what prices take.",
  elsewhereLine:
    "Set aside with no account to take it, as the broker’s margin: counted as cash.",
  incomeLine:
    "Enough to take out about {amount} a month: a pace ({rate} a year) that lasted {years} years from every start since 1970.",
  pastNotPromise:
    "The past does not tell the future: these are markets as they were, not a promise.",

  series: {
    world: "developed-market shares",
    us: "US shares",
    europe: "European shares",
    "bonds-fr": "10-year French government bonds",
    "fonds-euros": "the average fonds euros",
    bitcoin: "bitcoin",
    "livret-a": "the Livret A",
    lep: "the LEP",
    cash: "nothing: idle cash",
  },

  historyTitle: "Facing history",
  episodeLabel: "Which fall",
  fact2000:
    "The dot-com bubble: developed-market shares lost half their value in euros between summer 2000 and March 2003 — and 2008 came before they were back.",
  fact2008:
    "The financial crisis: almost half their value lost in euros between May 2007 and February 2009.",
  fact2020:
    "Covid: a fifth lost in three months, back before the year was out.",
  fact2022:
    "Inflation and rising rates: shares and bonds fell together, and the Livret A paid less than prices rose.",
  replayedFrom: "Your accounts today, replayed from the peak of {month}",
  lowLine: "At worst {loss} ({share}), in {month}",
  recovered: {
    one: "Your stake back after {count} month, keeping your payments going",
    other: "Your stake back after {count} months, keeping your payments going",
  },
  recoveredAlone: {
    one: "({count} without them)",
    other: "({count} without them)",
  },
  notRecovered: "Not back yet by {month}",
  neverBelow: "Your accounts would never have ended below what you put in.",
  absent: "Without {names}, whose history does not reach back that far.",
  noShares:
    "With no shares, history reaches your savings through prices: over a year, the Livret A ended below inflation {count} times in 100 since 1970.",
  noSharesLink: "Add an investment",
  chartValue: "What they were worth",
  chartInvested: "What you had put in",

  progressionTitle: "Progress",
  nextMilestone: "Next milestone: {amount}",
  milestoneWhen: "{month}, from the middle start",
  milestonesReached: "Reached",
  cushionLabel: "Safety cushion",
  runLink: "Close the month on Le point",

  hypothesesTitle: "Assumptions",
  hypothesesHide: "Hide the assumptions",
  hypothesesLead:
    "Filled in from your accounts and the history of what they follow. A return you change moves the account’s whole history: its falls keep their shape.",
  returnFromHistory: "History {from}–{to}: {rate}",
  returnContract: "Your contract’s rate",
  returnNone: "No history long enough for a return.",
  realTermsNote:
    "Everything is in today’s euros, with French inflation as INSEE measures it.",
  reconstructedNote:
    "Before 1986, shares are rebuilt from the OECD’s prices; before 2000, the fonds euros follows the 10-year French government bond.",
  sourcesTitle: "Sources",
};
