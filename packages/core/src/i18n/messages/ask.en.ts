/**
 * Ask Pluclair (`packages/core/src/ask-chat.ts`): the screen, its answers and
 * the tools it shows at work. `en.ts` mounts it as `ask`.
 */
export const askEn = {
  title: "Questions",
  intro:
    "Ask anything about your money: where it goes, how a month compares, what an early repayment would change. The answer is worked out from your own figures.",
  placeholder: "Ask a question…",
  send: "Ask",
  stop: "Stop",
  thinking: "Thinking…",
  new: "New question",
  delete: "Delete this conversation",
  deleted: "Conversation deleted",
  kept: "Kept {days} days, then deleted.",
  none: "No questions left this month: they come back on the 1st.",
  onAccount: "Paid on your AI account.",
  disclaimer:
    "AI can get things wrong, and gives no investment advice: check the figures that matter.",
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
  unusable: "The answer came back empty. Try asking another way.",
  busy: "Too many requests to the AI right now: try again in a minute.",
  accountRefused: "Your AI account refused the request: check it in Profile.",
  noCredit: "Your AI account has no credit left: top it up on OpenRouter.",
  tooLong: "Shorter, please: {max} characters at most.",
  stopped: "Stopped. The answer was not kept.",
  suggest1: "Where did my money go these last 3 months?",
  suggest2: "How does this month compare with the last one?",
  suggest3: "Which subscriptions could I cut?",
  suggest4: "What if I repaid €10,000 of my loan early?",
  openFromRead: "Ask a question",
  history: "Your conversations",
  historyEmpty: "No conversation yet.",
  looked: {
    one: "Looked at 1 thing",
    other: "Looked at {count} things",
  },
  untraced:
    "The AI's own figure: Pluclair did not find it in your data. Check it.",
  untracedNote: {
    one: "1 figure, dotted, is the AI's own: check it.",
    other: "{count} figures, dotted, are the AI's own: check them.",
  },
  copy: "Copy",
  copied: "Copied",
  step: {
    month: "The month",
    cashflow: "Money in and out",
    categories: "Spending by category",
    transactions: "Your entries",
    merchants: "Shops and payees",
    recurring: "Recurring entries",
    savings: "Savings",
    investments: "Investments",
    loans: "Loans",
    loan_prepayment: "Early repayment",
    calculate: "A calculation",
  },
};
