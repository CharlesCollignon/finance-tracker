/**
 * Ask Pluclair (`packages/core/src/ask.ts`): the screen, its answers and the
 * labels of the figures it hands the model. `en.ts` mounts it as `ask`.
 */
export const askEn = {
  title: "Questions",
  intro:
    "Ask about your money. The answers use Pluclair's figures, and Pluclair never advises.",
  placeholder: "Ask a question…",
  send: "Ask",
  thinking: "Looking at your figures…",
  new: "New question",
  delete: "Delete this conversation",
  deleted: "Conversation deleted",
  kept: "Kept {days} days, then deleted.",
  none: "No questions left this month: they come back on the 1st.",
  onAccount: "Paid on your AI account, a few cents each.",
  noAdvice:
    "Pluclair gives the figures, not advice: what to do with them is yours to decide.",
  outside:
    "That is not something Pluclair knows: it only holds your money's figures.",
  empty: "Pluclair does not hold what would answer this.",
  searchHeading: {
    one: "One entry « {query} »",
    other: "{count} entries « {query} »",
  },
  searchSpent: "{amount} in all, out less in",
  searchMore: "The latest are shown: search the Journal for the rest.",
  searchNone: "No entry « {query} ».",
  noAnswer: "No answer right now. Try again in a moment.",
  unusable:
    "The answer could not be shown: nothing in it held up. Try asking another way.",
  busy: "Too many requests to the AI right now: try again in a minute.",
  accountRefused: "Your AI account refused the request: check it in Profile.",
  noCredit: "Your AI account has no credit left: top it up on OpenRouter.",
  tooLong: "Shorter, please: {max} characters at most.",
  suggest1: "How much did I spend on groceries this month?",
  suggest2: "What is my largest recurring charge?",
  suggest3: "How many months do my savings cover?",
  suggest4: "Should I repay my loan early?",
  openFromRead: "Ask a question",
  history: "Your conversations",
  historyEmpty: "No conversation yet.",
  facts: {
    spentTotal: "Spent, {month}",
    spentCategory: "{name}, {month}",
    income: "Income, {month}",
    balanceToday: "On the account today",
    charge: "{name} (a month)",
    chargesOut: "Recurring spending, a month",
    chargesIn: "Recurring income, a month",
    savings: "Set aside",
    cushionMonths: "Months of fixed costs it covers",
    walletValue: "{name}, value",
    walletInvested: "{name}, paid in",
    walletsTotal: "Investments, value",
    loanOwed: "{name}, still owed",
    loanRate: "{name}, rate",
    loanMonthly: "{name}, monthly payment",
    loanInterestLeft: "{name}, interest still to pay",
    loanMonthsLeft: "{name}, payments left",
  },
};
