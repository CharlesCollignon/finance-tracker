/**
 * Every word on the marketing site.
 *
 * Kept in one file because the voice only holds if it can be read in one
 * sitting. Two rules it is worth restating whenever this is edited:
 *
 *   Say the mechanism, not the benefit. "One balance, once a month" is
 *   checkable; "effortless clarity" is not, and a reader who has been sold to
 *   before can tell the difference in about a second.
 *
 *   Never promise what the app does not do. There is no bank connection, no
 *   automation that fires on its own, and no advice. Writing around those
 *   would win a signup and lose the first session.
 */

export const landingCopy = {
  hero: {
    /** Split so the line break is a choice rather than whatever the box does. */
    titleLines: ["Your whole month,", "on one quiet screen"],
    tagline:
      "Income, bills, savings and investments — recorded by you, held privately, and reconciled against your real balance at the end of every month.",
    /** The two figures on the floating cards. Same month as every mock. */
    cards: {
      remaining: {
        label: "Left in March",
        caption: "of €3,200 earned",
      },
      unrecorded: {
        label: "Unrecorded · Feb",
        caption: "found by one balance",
      },
    },
  },

  pillars: {
    heading: "Three things it will not do",
    items: [
      {
        title: "Connect to your bank",
        body: "No credentials, no read-only tokens, no aggregator in the middle. You record what moved, which is the only version you can vouch for.",
      },
      {
        title: "Act without you",
        body: "Recurring items are templates, not automations. Nothing posts to a month until you apply it, and an applied row is still yours to edit.",
      },
      {
        title: "Tell you what to do",
        body: "There is no advice, no score and no nudge to switch products. The app measures; the decisions stay where they belong.",
      },
    ],
  },

  devices: {
    heading: "The same month, whichever screen is closest",
    body: "One account, one ledger, three clients that agree. Add a row on the phone on the way home and it is on the dashboard before you sit down.",
  },

  features: {
    heading: "Seven screens over one ledger",
    body: "Nothing here keeps a second set of numbers. Every screen is a different reading of the rows you entered.",
  },

  monthClose: {
    heading: "The one number the app cannot work out for itself",
    body: [
      "Every total on every other screen is a sum of movements you recorded. That is honest, and it is incomplete: the restaurant, the round of drinks, the thing bought on the way home never became a row, and no amount of arithmetic over the ledger can find them.",
      "One balance a month can. If the account held one figure at the last close and holds another now, and the rows only explain part of the difference, the remainder is spending the app never heard about. It costs you one number, once a month, on the same day each month.",
    ],
    /** The three outcomes a close produces, in the order the sheet shows them. */
    outcomes: [
      {
        label: "Unrecorded",
        body: "What the balance proves left the account that nothing accounts for. Measured, not remembered.",
      },
      {
        label: "Kept",
        body: "What the month actually added to your wealth: the cash it left behind plus everything set aside on purpose.",
      },
      {
        label: "The run",
        body: "Months in a row under your own allowance, which is set from your history rather than from a round number.",
      },
    ],
    footnote:
      "A balance higher than the rows allow is not a win — it means something is missing, and the close says so instead of quietly counting it.",
  },

  how: {
    heading: "Open it, fill it in, close it",
    beats: [
      {
        title: "Set what repeats, once",
        body: "Salary, rent, subscriptions, a monthly buy in the PEA. Each is a template with an amount and a rhythm — a share-priced one takes its amount from the current quote instead.",
      },
      {
        title: "Apply it to the month",
        body: "Applying turns what the month calls for into real rows you can still edit. Skip one, apply late, apply twice: the month is yours to describe accurately, not to keep tidy.",
      },
      {
        title: "Add the rest as you go",
        body: "Everything else you type in. What is left, the day-by-day calendar and the rings on the dashboard all read from that one ledger.",
      },
      {
        title: "Close it against the bank",
        body: "On your reading day, enter the one balance the app cannot know. It works out what it never saw, and what you actually kept.",
      },
    ],
  },

  privacy: {
    heading: "Nothing is connected, so there is nothing to revoke",
    body: "Your figures live in rows behind your login, and every query is scoped to your account — no other account can read them, because there is no query that would. There is no aggregator holding credentials on your behalf and nothing to sell, because there is nobody to sell it to.",
    points: [
      "Wipe every row and keep the account.",
      "Delete the account and take the rows with it.",
      "Blur every figure on screen with one tap, for the train.",
    ],
  },

  finalCta: {
    heading: "Start with this month",
    body: "One salary, one rent, and whatever else you can remember. About four minutes, and no card.",
  },

  pages: [
    {
      id: "home",
      title: "Dashboard",
      body: "What is left this month, where the income went, and whether the budget and the goal still hold.",
      utility:
        "One screen for the month: what is left, where income went, and whether the cap and the savings target still hold. It answers the question you opened the app to ask before you have finished asking it.",
      steps: [
        {
          title: "Open the month",
          body: "Home is the current month. Income, spending and every recurring item you applied land here, under whichever budget view you prefer — counted up to today, or counted for everything the month will contain.",
        },
        {
          title: "Read what is left",
          body: "The hero figure is what remains. Underneath it, earned against spent, so the gap is a shape rather than a subtraction you have to do.",
        },
        {
          title: "Check the rings",
          body: "The budget ring and the goal ring follow the caps and targets you set in Planning. Nothing here is a projection: both read from rows that exist.",
        },
      ],
    },
    {
      id: "transactions",
      title: "Transactions",
      body: "A manual ledger you own. Apply what recurs, then change anything.",
      utility:
        "The ledger is the source of truth for every other screen. Nothing is imported, so nothing arrives miscategorised, duplicated, or three days late — you type the rows, and what is left follows them.",
      steps: [
        {
          title: "Apply what recurs",
          body: "Salary, bills and a monthly buy can fill the month in one pass, when you choose to apply them. Each becomes an ordinary row afterwards.",
        },
        {
          title: "Add and edit freely",
          body: "Change a date, an amount or a category. Add a one-off. Delete a mistake. Tag rows and filter by tag when you want a narrower view than a category gives.",
        },
        {
          title: "Everything else follows",
          body: "What is left, the dashboard split, the calendar and the close all read from here. There is no second place a number can disagree with itself.",
        },
      ],
    },
    {
      id: "recurring",
      title: "Recurring",
      body: "Salary, rent, subscriptions, a monthly buy. Applied when you say so.",
      utility:
        "Templates for what repeats, monthly, weekly or yearly, optionally bounded by a start and an end. They do not run on their own — which is the point, because a standing instruction that fires unattended is how a ledger drifts away from the truth.",
      steps: [
        {
          title: "Define a template",
          body: "An amount and a rhythm. A share-priced template takes its amount from the current quote instead of a fixed figure, so a monthly buy is worth what it cost rather than what you guessed.",
        },
        {
          title: "Apply, skip, or leave it",
          body: "Nothing exists until you apply it. Skip a single month without deactivating the template, or deactivate it and stop all of them.",
        },
        {
          title: "Kept in line with the market",
          body: "An applied occurrence still dated ahead is repriced when its quote moves, quietly and without asking — the market moving is not a decision anyone made. Once its date has passed, its amount is what actually moved and stays put.",
        },
      ],
    },
    {
      id: "calendar",
      title: "Calendar",
      body: "The same rows laid on days, so the month has a shape.",
      utility:
        "The ledger, arranged by day. Useful for the question a list answers badly: not what did I spend, but when does this month get tight.",
      steps: [
        {
          title: "Read the month at once",
          body: "Every day carries its net, in and out. The heavy days stand out without you opening anything.",
        },
        {
          title: "Open a day",
          body: "In and out for that day sit together, so the day's cashflow is legible rather than reconstructed from a scroll.",
        },
        {
          title: "Change it in one place",
          body: "The calendar points back to the ledger to edit a row. It keeps no numbers of its own, so it can never be the screen that is out of date.",
        },
      ],
    },
    {
      id: "wallets",
      title: "Wallets",
      body: "PEA, CTO and crypto. Quotes refresh the value; the positions stay yours.",
      utility:
        "Where invested value sits, recorded by you. Quotes bring the valuation up to date; there is no broker login and no order ever leaves this app.",
      steps: [
        {
          title: "Record what you hold",
          body: "A wallet per envelope — PEA, CTO, crypto — and a position per instrument inside it, with what went in and what it is worth now.",
        },
        {
          title: "Quotes do the revaluing",
          body: 'Prices come from a quote source in euro, whatever the instrument was originally quoted in. "No price right now" is an ordinary answer, and the last known quote covers for it.',
        },
        {
          title: "See the split",
          body: "Allocation across wallets, and gain against what you put in. A reading for you, not a feed from anyone.",
        },
      ],
    },
    {
      id: "planning",
      title: "Planning",
      body: "A cap per category, a savings target per month.",
      utility:
        "Caps and targets, and nothing that enforces them. A budget is a cap on what one category may spend in a month; a savings goal is an amount you intend to accumulate. Both turn into rings on the dashboard and neither moves money.",
      steps: [
        {
          title: "Set a cap",
          body: "A monthly limit on a category. The ring fills as the ledger spends against it and changes tone before you reach it, not after.",
        },
        {
          title: "Set a target",
          body: "An amount to accumulate, tracked against your savings rows, with the monthly pace it would take to arrive by the date you named.",
        },
        {
          title: "Watch it on Home",
          body: "The dashboard reads these figures directly. Change a cap or a target and the rings move with it.",
        },
      ],
    },
    {
      id: "month-close",
      title: "Month close",
      body: "One balance, once a month, and the app tells you what it never saw.",
      utility:
        "The only place the app asks for something it cannot work out for itself. Everywhere else it reasons about movements it was told about; this is where one real balance measures the spending nobody types in.",
      steps: [
        {
          title: "Pick a reading day",
          body: "The same day of the following month, every month — deliberately not the last of the month, because with a deferred-debit card the month's card spending has not landed by then.",
        },
        {
          title: "Enter one balance",
          body: "What the account your spending actually leaves from held on that day. The first close is a baseline: it sets the point everything after is measured from.",
        },
        {
          title: "Read what it found",
          body: "Unrecorded spending, what you kept, and whether the month stayed inside your own allowance — which is set from your history, not from a round number you would only argue with.",
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
  exampleLabel: "Example data",
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
