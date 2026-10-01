/**
 * The accounts a user keeps — savings accounts and investment wallets — as
 * Placements lists them and the Plan breaks the future down by them. One set
 * of words for the web and the phone; `en.ts` mounts it as `accounts`.
 *
 * The short names of the French accounts are proper names and stay French
 * in English, as the banks print them.
 */
export const accountsEn = {
  shortSavings: "Savings",
  shortLivretA: "Livret A",
  shortLdds: "LDDS",
  shortLep: "LEP",
  shortCel: "CEL",
  shortPel: "PEL",
  shortLivret: "Other savings",
  shortPea: "PEA",
  shortCto: "CTO",
  shortAv: "Life insurance",
  shortPer: "PER",
  shortCrypto: "Crypto",

  nameLivretA: "Livret A",
  nameLdds: "Sustainable development savings account",
  nameLep: "Popular savings account",
  nameCel: "Home savings account",
  namePel: "Home savings plan",
  nameLivret: "A bank's own savings account",

  taxFree: "None: no income tax and no social contributions.",
  taxCel: "30% flat tax on the interest, every year.",
  taxPel:
    "30% flat tax on the interest, every year — the PEL was spared the 2026 rise.",
  taxLivret: "31.4% flat tax on the interest, every year.",
  rateRegulated: "Set by the State, reviewed on 1 February and 1 August.",
  ratePel:
    "A PEL keeps the rate of the year it was opened: 2% for one opened in 2026.",
  rateLivret: "Your bank's rate.",

  yourAccounts: "Your accounts",
  savingsGroup: "Savings",
  investGroup: "Investments",
  total: "What you own",
  split: "Savings {savings} · Investments {investments}",

  add: "Add an account",
  addTitle: "Which account?",
  addBalance: "How much is in it today?",
  addRate: "Rate per year",
  addFromBank: "Read the balance from your bank",
  addTypeIt: "I'll type it",
  addConfirm: "Add",
  added: "{name} added.",
  addedSavings: "{name} added. What you log in “{category}” is added to it.",
  allAdded: "You have every kind of account already.",

  balanceAsOf: "on {date}",
  balanceFromBank: "read from your bank on {date}",
  addedSince: "including {amount} logged since",
  ratePerYear: "{rate} a year",
  interestPerYear: "≈ {amount} of interest a year, after tax",
  ceilingOf: "{balance} of {ceiling}",
  ceilingReached: "Ceiling reached",
  monthlyPlanned: "{amount} planned each month",
  monthlyNone: "Nothing planned each month.",
  notLiquid:
    "A withdrawal closes a PEL, so it is not counted in your safety cushion.",
  categoryLine: "What you log in “{category}” is added to the balance.",
  updateBalance: "Update the balance",
  editRate: "Change the rate",
  save: "Save",
  saved: "Saved.",
  linkBank: "Read the balance from your bank",
  unlinkBank: "Stop reading it from the bank",

  remove: "Remove this account",
  removeSavingsConfirm: "Remove {name}? Its transactions stay in the Ledger.",
  removeWalletConfirm: {
    one: "Remove {name} and its {count} holding?",
    other: "Remove {name} and its {count} holdings?",
  },
  removed: "{name} removed.",

  emptyTitle: "Add your accounts",
  emptyBody:
    "Livret A, PEL, PEA… Add the ones you have, and the Plan will show what each one becomes.",

  breakdown: "By account",

  analysisIntro:
    "What each account earns, how your money is spread, and what it costs you.",
  returnSavings: "{rate} a year, after tax",
  returnSavingsHint:
    "A savings account earns its rate: no gain or loss on the price.",
  feesNone: "No fees",
};
