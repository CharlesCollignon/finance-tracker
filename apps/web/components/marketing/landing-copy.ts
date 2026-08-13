export const landingCopy = {
  hero: {
    tagline: "Income, recurring, investments — clear and quiet.",
    sub: "No bank connection. You type it in.",
  },
  how: {
    heading: "How it works",
    beats: [
      {
        title: "No bank link.",
        body: "Nothing is pulled from an account. You add income, expenses, and investments yourself.",
      },
      {
        title: "A private database.",
        body: "Your numbers live in a small cloud database behind your login. Each account only sees its own rows.",
      },
      {
        title: "Your month, clearly.",
        body: "Recurring templates fill the ledger when you apply them. Home, calendar, and wallets show what you entered.",
      },
    ],
    footnote: "You can wipe your data or delete the account anytime.",
  },
  pages: [
    {
      id: "home",
      title: "Dashboard",
      body: "Remaining this month. Where income went. Budget and goal rings.",
      utility:
        "One screen for the month: what is left, where income went, and whether the budget and savings goal still hold.",
      steps: [
        {
          title: "Open the month",
          body: "Home is the current month. Income, spend, and recurring you applied all land here.",
        },
        {
          title: "Read what’s left",
          body: "The hero number is remaining. A split shows earned versus spent so the gap is obvious.",
        },
        {
          title: "Check the rings",
          body: "Budget and goal rings sit under that number. They follow the caps and targets you set in Planning.",
        },
      ],
    },
    {
      id: "transactions",
      title: "Transactions",
      body: "A manual ledger for the month. Apply recurring, then edit.",
      utility:
        "The ledger is the source of truth. Nothing is imported. You type rows, then remaining and the calendar follow.",
      steps: [
        {
          title: "Apply recurring",
          body: "Salary, bills, and DCA templates can fill the month in one pass when you choose to apply them.",
        },
        {
          title: "Add or edit rows",
          body: "Change a date, amount, or category. Add a one-off. Delete a mistake. It stays a list you own.",
        },
        {
          title: "Remaining updates",
          body: "What’s left, the dashboard split, and the calendar all read from this ledger — not from a bank.",
        },
      ],
    },
    {
      id: "recurring",
      title: "Recurring",
      body: "Salary, bills, and DCA templates. Applied when you say so.",
      utility:
        "Templates for what repeats. They do not run on their own. You apply them to the month, then the ledger has the rows.",
      steps: [
        {
          title: "Define templates",
          body: "Salary, rent, subscriptions, a monthly DCA — each is a template with an amount and a rhythm.",
        },
        {
          title: "Apply when you choose",
          body: "Nothing posts until you apply. Skip a month, apply late, or apply twice if that matches how you live.",
        },
        {
          title: "They land in the ledger",
          body: "Applied templates become transactions you can still edit. Home and calendar pick them up from there.",
        },
      ],
    },
    {
      id: "calendar",
      title: "Calendar",
      body: "Day-by-day cashflow for the month.",
      utility:
        "The same ledger, laid on days. See when money comes in and goes out without opening every row.",
      steps: [
        {
          title: "Pick a day",
          body: "The month grid shows activity. Open a day to see what you already entered.",
        },
        {
          title: "See in and out",
          body: "Income and spend for that day sit together so the day’s cashflow is readable at a glance.",
        },
        {
          title: "Jump to the ledger",
          body: "Need to change a row? The calendar points back to transactions — it does not keep a second set of numbers.",
        },
      ],
    },
    {
      id: "wallets",
      title: "Wallets",
      body: "PEA, CTO, and crypto you track. Quotes for value — not a broker login.",
      utility:
        "Holdings you record yourself. Quotes refresh value. There is no broker login and no order routing.",
      steps: [
        {
          title: "Add holdings",
          body: "PEA, CTO, crypto — name the wallet, add what you hold, and keep quantities in line with reality.",
        },
        {
          title: "Quotes refresh value",
          body: "Market quotes update what those holdings are worth. You still entered the positions.",
        },
        {
          title: "See allocation",
          body: "The split across wallets is for you to read, not a feed from a bank or a broker.",
        },
      ],
    },
    {
      id: "planning",
      title: "Planning",
      body: "Spending caps and savings goals.",
      utility:
        "Caps and goals live under Budgets on web, and Planning from Profile on mobile. Home turns them into rings. They do not move money on their own.",
      steps: [
        {
          title: "Set a cap",
          body: "A monthly spending limit. The dashboard ring fills as the ledger spends against it.",
        },
        {
          title: "Set a goal",
          body: "A savings target for the month. You mark progress; the ring follows what you recorded.",
        },
        {
          title: "Home rings follow",
          body: "Dashboard reads these numbers. Change a cap or a goal and the rings update.",
        },
      ],
    },
  ],
  cta: {
    getStarted: "Get started",
    signIn: "Sign in",
    openApp: "Open app",
    goToDashboard: "Go to dashboard",
  },
  exampleLabel: "Example",
} as const;

export type LandingPageId = (typeof landingCopy.pages)[number]["id"];

export function isLandingPageId(slug: string): slug is LandingPageId {
  return landingCopy.pages.some((page) => page.id === slug);
}

export function featureHref(id: LandingPageId): string {
  return `/features/${id}`;
}

export function getLandingPage(id: LandingPageId) {
  const page = landingCopy.pages.find((entry) => entry.id === id);
  if (!page) {
    throw new Error(`Unknown landing page: ${id}`);
  }
  return page;
}

export function adjacentLandingPages(id: LandingPageId) {
  const index = landingCopy.pages.findIndex((page) => page.id === id);
  const prev = index > 0 ? landingCopy.pages[index - 1] : undefined;
  const next =
    index >= 0 && index < landingCopy.pages.length - 1
      ? landingCopy.pages[index + 1]
      : undefined;
  return {
    prev: prev ?? null,
    next: next ?? null,
  };
}
