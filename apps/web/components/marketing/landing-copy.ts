import type { Locale } from "@finance/core/i18n/locale";
import { landingCopyFr } from "@/components/marketing/landing-copy.fr";

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
 *   Never promise what the app does not do. A bank can now be connected, and
 *   that changes what is safe to claim: the access is read-only, a row is only
 *   ever filed by a rule the user wrote, and there is still no advice. Writing
 *   around any of that would win a signup and lose the first session.
 */

export const landingCopy = {
  hero: {
    /** Split so the line break is a choice rather than whatever the box does. */
    titleLines: ["Your whole month,", "on one quiet screen"],
    tagline:
      "Income, bills, savings and investments — recorded by you or read from your bank, held privately, and reconciled against your real balance at the end of every month.",
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
        title: "Move your money",
        body: "The bank connection reads and nothing else. It can see what left the account; it cannot start a payment, and there is no version of it that could.",
      },
      {
        title: "Act on a rule you did not write",
        body: "A statement row files itself only where you have already put that shop somewhere twice. Everything else waits in a list, and a recurring item is a template until you apply it.",
      },
      {
        title: "Tell you what to do",
        body: "There is no advice, no score and no nudge to switch products. The app measures; the decisions stay where they belong.",
      },
    ],
  },

  devices: {
    heading: "The same month, whichever screen is closest",
    body: "One account, one ledger, three clients that agree. Add a row on the phone on the way home and the Bearing has it before you sit down.",
  },

  features: {
    heading: "Every screen is the same ledger",
    body: "Nothing here keeps a second set of numbers. Your entries and your statement land in one place, and every screen is a different reading of it.",
  },

  monthClose: {
    heading: "The number that checks all the others",
    body: [
      "Every total on every other screen is a sum of movements — some you typed, some the statement brought. That is honest, and it is incomplete: cash out of a machine, a card the feed does not cover, a month the sync missed. No amount of arithmetic over the rows can find what is not in them.",
      "The balance can. If the account held one figure at the end of last month and another at the end of this one, and the rows only explain part of the gap, the remainder is spending nothing accounted for. With a bank connected the app reads both figures off the statement itself, so the check costs you nothing; without one, it costs a single number a month.",
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

  monthRead: {
    heading: "The words are written for you. The figures are not.",
    body: [
      "Ask for a read and a language model writes a few sentences about the month you are looking at. It never types a number. It refers to a figure by name — unrecorded spending, what you kept, the cap you set — and the app substitutes its own value before the sentence reaches you. A sentence resting on a figure the app did not compute is dropped; if the headline is the one that broke, the whole read is thrown away and nothing is stored.",
      "That fixes the arithmetic, not the opinion. “You are spending noticeably more on groceries” contains no figure, so nothing above can check it — it is a judgement, and it is the model's. This is a second pair of eyes on the month, not a verdict on it, and it is the only place in the app where anything is written for you.",
    ],
    outcomes: [
      {
        label: "On request",
        body: "Nothing is written until you ask. Each read is stored with the figures it was written from, so what it was looking at stays visible next to what it said.",
      },
      {
        label: "Your words",
        body: "The model is held to the app's own terms. A read calling a month close a “reconciliation” would contradict every label printed around it, and you would have no way to tell which of the two was wrong.",
      },
      {
        label: "It ages",
        body: "The figures on screen are always current. The judgement is not: “comfortably inside your allowance” stops being true when it stops being true, so a read is marked once the figures under it have moved.",
      },
    ],
    footnote:
      "Suggestions sit under a heading of their own, never mixed into the observations — so nothing it proposes can be mistaken for something it measured.",
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
        body: "Everything else you type in. What is left, the day-by-day calendar and every card on the Bearing all read from that one ledger.",
      },
      {
        title: "Close it against the bank",
        body: "On your reading day, enter the one balance the app cannot know. It works out what it never saw, and what you actually kept.",
      },
    ],
  },

  privacy: {
    heading: "Read-only, server-side, and yours to cut off",
    body: "Your figures live in rows behind your login, and every query is scoped to your account — no other account can read them, because there is no query that would. Connecting a bank is optional; where you do, the access is the kind that can only read, the credentials never reach a browser, and there is nothing to sell because there is nobody to sell it to.",
    points: [
      "Read-only access, so it can see what moved and never move it.",
      "Revoke the bank at any time; the rows it already filed stay yours.",
      "Wipe every row and keep the account, or delete both.",
      "Blur every figure on screen with one tap, for the train.",
    ],
  },

  finalCta: {
    heading: "Start with this month",
    body: "One salary, one rent, and whatever else you can remember. About four minutes, and no card.",
  },

  pages: [
    {
      id: "bearing",
      title: "Bearing",
      body: "Where the whole of it stands on one day, and where it is heading.",
      utility:
        "Two figures at the top, and five cards underneath that take the rest apart. Nothing on it is a figure invented here: every one is something another surface already shows, which is what makes it checkable rather than a second set of books.",
      steps: [
        {
          title: "Read the two figures",
          body: "What is currently in your current account, and what the month finishes at once everything it already knows about has happened. The second is arithmetic on charges you have already entered, not a guess about what you might spend.",
        },
        {
          title: "Open a card where you want the detail",
          body: "This month, The accounts, Your run, The year ahead, Wallets. A card is its name and one figure until you open it; open it and it lists the figures behind that one and draws what they are made of, in place, without leaving the screen.",
        },
        {
          title: "Follow it to the surface that owns it",
          body: "Each card ends with the surfaces that explain it. A figure with somewhere to go is a link, and a figure with nowhere honest to lead is not dressed as though it were.",
        },
      ],
    },
    {
      id: "ledger",
      title: "Ledger",
      body: "Every movement — as a list, laid on days, or a run of months per category.",
      utility:
        "The record everything else reads from. Rows you typed, rows a template applied, and rows the statement brought that a habit of your own filed — one body of data, looked at three ways.",
      steps: [
        {
          title: "The list, the calendar, or by category",
          body: "The same rows throughout. The list is for finding one and changing it; the calendar lays them on days, which answers when the month gets tight rather than what you spent; by category gives each one its own twelve months, what it normally costs, and what has drifted away from that.",
        },
        {
          title: "What the bank sends waits for you",
          body: "A statement row files itself only where you have put that shop in the same place twice — the point at which it is a habit rather than a coincidence. Everything else waits in the review inbox, money arriving always among it. Answering one teaches the matcher, which is why the inbox shrinks instead of becoming a permanent chore.",
        },
        {
          title: "Or bring a CSV",
          body: "An export from your bank, with its columns mapped once. The same history that files the feed guesses at these, and nothing is written until you have read the list it proposes.",
        },
      ],
    },
    {
      id: "charges",
      title: "Charges",
      body: "Salary, rent, subscriptions, a monthly buy. Applied when you say so.",
      utility:
        "Standing instructions for what repeats, monthly, weekly or yearly, optionally bounded by a start and an end. They do not run on their own — which is the point, because an instruction that fires unattended is how a ledger drifts away from the truth.",
      steps: [
        {
          title: "Define what repeats",
          body: "An amount and a rhythm. A share-priced template takes its amount from a share count times the current quote instead of a fixed figure, so a monthly buy is worth what it cost rather than what you guessed.",
        },
        {
          title: "Apply it, skip it, or say it already happened",
          body: "Nothing exists until you apply it, and applying writes ordinary rows you can still edit. Skip a single month without deactivating the template. And where the statement reported the movement itself, say that this is the one the template called for, instead of leaving a second row beside it.",
        },
        {
          title: "Kept in line with the market",
          body: "An applied occurrence still dated ahead is repriced when its quote moves, quietly and without asking — the market moving is not a decision anyone made. Once its date has passed, its amount is what actually moved and stays put.",
        },
      ],
    },
    {
      id: "plan",
      title: "Plan",
      body: "Caps, targets, the months ahead, and the balance that checks them.",
      utility:
        "What you have decided about money, and what those decisions add up to. A cap on a category, an amount to accumulate, the months your standing charges lead to, and the one balance a month is closed against. Nothing here enforces anything or moves anything.",
      steps: [
        {
          title: "Set a cap, set a target",
          body: "A monthly limit on a category, and an amount to accumulate with the pace it would take to arrive by the date you named. Both fill as the ledger runs against them, and both change tone before you reach them rather than after.",
        },
        {
          title: "See where the months lead, and take it apart",
          body: "Two lines, not one: what the spending accounts hold, and that plus everything set aside along the way. There are two because one was a lie — a single line counting money moved into savings as money gone had a diligent saver watching their position sink. Both come apart into what they are made of: income from charges, what is committed, what is set aside, and what a normal month costs unseen, each with the charges backing it and a way to go and change it.",
        },
        {
          title: "Close the month against the bank",
          body: "On your reading day, the one balance the app cannot work out for itself. It measures what no arithmetic over the rows could find, and what it finds has a page of its own.",
        },
      ],
    },
    {
      id: "wallets",
      title: "Wallets",
      body: "PEA, CTO, AV, PER and crypto — what you hold, and what it is really made of.",
      utility:
        "Where invested value sits, recorded by you. Quotes bring the valuation up to date; there is no broker login, and no order ever leaves this app.",
      steps: [
        {
          title: "Record what you hold",
          body: 'A wallet per envelope, and a position per instrument inside it, with what went in and what it is worth now. Prices arrive in euro whatever the instrument was originally quoted in, and "no price right now" is an ordinary answer that the last known quote covers for.',
        },
        {
          title: "See through to what you actually own",
          body: "Two funds can hold the same company, and neither says so. The look-through resolves your positions through what each instrument has been read to contain — countries, sectors, the largest holdings underneath — over the value it could resolve, and reports the rest as unread rather than quietly leaving it out.",
        },
        {
          title: "Ask for a read of the whole of it",
          body: "A dated account of what is invested: what it observes, what it suggests, and the target allocation those suggestions imply. It names instruments only from a fixed catalogue and writes no figure of its own — it chooses a role and a size, and the app turns those into percentages.",
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
          body: "What the account your spending actually leaves from held on that day. With a bank connected the app reads it off the statement instead. The first close is a baseline: it sets the point everything after is measured from.",
        },
        {
          title: "Read what it found",
          body: "Unrecorded spending, what you kept, and whether the month stayed inside your own allowance — which is set from your history, not from a round number you would only argue with.",
        },
      ],
    },
    {
      id: "month-read",
      title: "Month read",
      body: "A few sentences about the month, where the prose is a model's and every figure is the app's.",
      utility:
        "Every other surface hands you a figure or a list. This one reads them together and says what stands out — without being allowed to invent a number to say it with. Useful on the months where the totals look ordinary and something underneath them is not.",
      steps: [
        {
          title: "Ask for it",
          body: "A read is written when you press for one, never on sight. Five a month, which is more than enough for a month that changes and a ceiling on anything that presses the button in a loop.",
        },
        {
          title: "Read what it found",
          body: "Observations first, and any suggestions under a heading of their own. Every figure in the prose is the app's own, substituted into the sentence after the model named which one it meant.",
        },
        {
          title: "Ask again when it ages",
          body: "The figures never go stale, but the judgement does. When what is underneath has moved enough to change the reading, the read says so and you can ask for another.",
        },
      ],
    },
  ],

  cta: {
    getStarted: "Get started",
    signIn: "Sign in",
    openApp: "Open app",
    goToDashboard: "See where you stand",
  },
  exampleLabel: "Example data",
} as const;

export type LandingPageId = (typeof landingCopy.pages)[number]["id"];

/* --------------------------------------------------------------- languages */

/**
 * Widen the literal types `as const` gives the English copy.
 *
 * The `as const` is load-bearing above — `LandingPageId` is derived from it,
 * and those ids are routes. But it also makes every sentence its own type,
 * which no translation can satisfy. This maps the shape back to plain strings
 * so another language can be checked against it: same keys, same nesting,
 * different words.
 */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Widen<U>[]
    : { -readonly [K in keyof T]: Widen<T[K]> };

/** One feature page's prose, without the id — which is a route, not copy. */
export type LandingPageCopy = Widen<
  Omit<(typeof landingCopy.pages)[number], "id">
>;

/** Everything on the site except the feature pages. */
export type LandingCopySections = Widen<Omit<typeof landingCopy, "pages">>;

/**
 * The copy for one language, in the shape every consumer already expects.
 *
 * The ids live once, in the English array, and each language supplies only
 * the prose against them. That is what stops a translation from inventing a
 * route or dropping a page: `Record<LandingPageId, …>` will not compile
 * without all seven, and none of them can name an eighth.
 */
export function landingCopyFor(locale: Locale) {
  if (locale === "en") {
    return landingCopy as unknown as LandingCopySections & {
      pages: ((typeof landingCopy.pages)[number] & { id: LandingPageId })[];
    };
  }

  const { pages, ...sections } = landingCopyFr;
  return {
    ...sections,
    // Ordered by the English array rather than by the record's own keys, so
    // the feature nav and the previous/next links keep one order across both
    // languages.
    pages: landingCopy.pages.map((page) => ({
      id: page.id,
      ...pages[page.id],
    })),
  };
}

export type LocalisedLandingCopy = ReturnType<typeof landingCopyFor>;

export function isLandingPageId(slug: string): slug is LandingPageId {
  return landingCopy.pages.some((page) => page.id === slug);
}

export function featureHref(id: LandingPageId): string {
  return `/features/${id}`;
}

export function getLandingPage(id: LandingPageId, locale: Locale = "en") {
  const page = landingCopyFor(locale).pages.find((entry) => entry.id === id);
  if (!page) {
    throw new Error(`Unknown landing page: ${id}`);
  }
  return page;
}

export function adjacentLandingPages(id: LandingPageId, locale: Locale = "en") {
  const all = landingCopyFor(locale).pages;
  const index = all.findIndex((page) => page.id === id);
  const prev = index > 0 ? all[index - 1] : undefined;
  const next =
    index >= 0 && index < all.length - 1 ? all[index + 1] : undefined;
  return {
    prev: prev ?? null,
    next: next ?? null,
  };
}
