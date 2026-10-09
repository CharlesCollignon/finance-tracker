import type { Locale } from "@finance/core/i18n/locale";
import { landingCopyFr } from "@/components/marketing/landing-copy.fr";

/**
 * Every word on the marketing site.
 *
 * Kept in one file because the voice only holds if it can be read in one
 * sitting. Three rules it is worth restating whenever this is edited:
 *
 *   Write for someone who is not in finance. Short sentences, everyday
 *   words, one concrete example per idea — "the groceries, the dinner out" —
 *   and the app's own names for its screens, so the page and the app agree.
 *
 *   Say the mechanism, not the benefit. "Copy the balance your bank shows"
 *   is checkable; "effortless clarity" is not, and a reader who has been sold
 *   to before can tell the difference in about a second.
 *
 *   Never promise what the app does not do. What is not open to everyone yet
 *   — the bank connection, the mobile app —
 *   is said once, under "Coming soon", in the future tense, and nowhere in
 *   the present (the owner's call, October 2026).
 */

export const landingCopy = {
  hero: {
    /** Split so the line break is a choice rather than whatever the box does. */
    titleLines: ["Your money,", "clearer every month"],
    tagline:
      "Income, spending, savings and investments in one place. What repeats fills itself in each month, and once a month Pluclair checks against your bank to find what slipped through.",
  },

  /** The three commitments, as one sentence rather than three cards. */
  promise: {
    text: "Three things Pluclair will never do: touch your money, decide for you, or sell you anything.",
  },

  /**
   * One question a person actually asks, per screen that answers it — the
   * rows of the "How it works" section, each beside a picture of that screen.
   */
  how: {
    heading: "How it works",
    rows: {
      bearing: {
        question: "Where do I stand this month?",
        body: "The Overview shows what is in your account today, and what will be left at the end of the month once everything already planned has gone out. Tap a card to see what is behind a figure.",
        link: "See the Overview",
      },
      charges: {
        question: "Note what repeats, once",
        body: "Rent, salary, subscriptions, a monthly top-up to your savings: you note each one once, and every month it adds itself. You only note the rest — the groceries, the dinner out, the birthday present. Or import your bank’s CSV statement: Pluclair suggests a category for each line, and you confirm.",
        link: "See Recurring",
      },
      "month-close": {
        question: "Where did the rest go?",
        body: "Once a month, copy the balance your bank shows. Pluclair compares it with what you noted, and the gap is money that left without a trace: a cash withdrawal, a payment you forgot. Now you can see it, in euros.",
        link: "See the month close",
      },
      plan: {
        question: "How long could I hold out?",
        body: "The Plan counts your safety cushion in months of fixed spending, shows the milestones your savings will pass and when, and what each account could be worth in ten or twenty years, after French tax.",
        link: "See the Plan",
      },
      wallets: {
        question: "What are my investments really worth?",
        body: "PEA, life insurance, brokerage account, PER, crypto: what you put in, what it is worth today, and what your funds are made of — shares, bonds, gold, crypto, countries, fees. Prices update on their own, and no order ever leaves the app.",
        link: "See Investments",
      },
      property: {
        question: "And your home?",
        body: "The property you own or let: its estimated value from the sales recorded around it, what is left on the loan, and how much of it is really yours. The loan's monthly payment joins your recurring entries on its own.",
        link: "See Property",
      },
      "month-read": {
        question: "Want your month explained?",
        body: "Ask for a read and an AI writes a few sentences about your month: what changed, what deserves a look. Or ask your own question in Questions. The figures always come from Pluclair — the AI is not allowed to make up a single one, nor to tell you what to do.",
        link: "See written reads",
      },
    },
  },

  /** What is built and not open to everyone yet. Future tense, here only. */
  soon: {
    heading: "Coming soon",
    items: [
      {
        title: "Your bank, connected",
        body: "Read-only: your transactions will arrive on their own, and Pluclair will never be able to make a payment.",
      },
      {
        title: "The mobile app",
        body: "Pluclair in your pocket, with the same figures as on your computer.",
      },
    ],
  },

  /** The worries a first visit has, answered plainly. Anchored as #privacy. */
  faq: {
    heading: "Your questions",
    items: [
      {
        question: "Does it cost anything?",
        answer:
          "Pluclair is free, and no card is asked for. Reads and questions, written by an AI, need your own OpenRouter account: you choose the model there — Mistral, ChatGPT or Claude — and pay that service directly, a few cents each. The bank connection, when it comes, will be paid to its service.",
      },
      {
        question: "Can Pluclair touch my money?",
        answer:
          "No, never. It makes no transfer and no payment, and the bank connection on its way will only be able to read.",
      },
      {
        question: "Where does my data go?",
        answer:
          "It stays on servers in Europe, behind your login. Nobody else can read it — except, in a shared space, the one person you invite into it — nothing is sold, and you can delete everything whenever you want.",
      },
      {
        question: "Do I need to connect my bank?",
        answer:
          "No. You note your transactions yourself, or import a CSV statement from your bank. A read-only connection is coming for those who want it.",
      },
      {
        question: "What does the AI see?",
        answer:
          "Only the figures of the page you ask it to read, or those a question needs: totals, category names, the lines of your investments — and a question as you typed it. Never your name, your email or your bank details — and nothing is written until you ask.",
      },
      {
        question: "Can I hide my figures in public?",
        answer:
          "Yes: one tap blurs every amount on screen. Handy on the train.",
      },
    ],
  },

  finalCta: {
    heading: "Start with this month",
    body: "A salary, a rent, and whatever you remember. A few minutes, and no card.",
  },

  pages: [
    {
      id: "bearing",
      title: "Overview",
      body: "Where you stand today, and where the month will end.",
      utility:
        "Two figures at the top: what is in your account now, and what will be left at the end of the month. Below, a few cards that open to show the detail — every figure comes from another screen, so you can always check it.",
      steps: [
        {
          title: "Read the two figures",
          body: "Today’s balance, and the end of the month once everything already planned has gone out. The second is simple arithmetic on what you planned, not a guess at what you might spend.",
        },
        {
          title: "Open a card for the detail",
          body: "This month, your accounts, your savings, your investments. Each card opens in place and shows what makes up its figure.",
        },
        {
          title: "Follow it to where it comes from",
          body: "Each card ends with a link to the screen that holds its figures, so nothing is counted twice.",
        },
      ],
    },
    {
      id: "ledger",
      title: "Ledger",
      body: "Every transaction — as a list, on a calendar, or by category.",
      utility:
        "Everything that comes in and goes out, in one place: what you typed, what your recurring items added, and what you imported from your bank.",
      steps: [
        {
          title: "A list, a calendar, or by category",
          body: "The same lines, three ways. The list to find and fix one; the calendar to see which days the month gets tight; by category to see what each one usually costs.",
        },
        {
          title: "It suggests, you decide",
          body: "Put a shop in the same category twice and Pluclair suggests it the next time. You confirm, and the suggestions get better — the filing stays yours.",
        },
        {
          title: "Or bring a CSV",
          body: "Export a statement from your bank and set its columns once. Nothing is written until you have read the list.",
        },
      ],
    },
    {
      id: "charges",
      title: "Recurring",
      body: "Salary, rent, subscriptions, monthly savings — written into each month for you.",
      utility:
        "Note once what comes back every month, week or year. Each one is added on its day, and only if it is missing: a line you corrected by hand is never overwritten.",
      steps: [
        {
          title: "Note what repeats",
          body: "An amount and a rhythm. For a monthly purchase of shares, the amount follows the price on the day.",
        },
        {
          title: "Added on its day",
          body: "Each one arrives as an ordinary line you can still change. Skip one, and only that month goes without it; the next ones carry on.",
        },
        {
          title: "Change it once for every month ahead",
          body: "Edit a recurring item and every coming month follows. This month’s lines change only if you say so.",
        },
      ],
    },
    {
      id: "plan",
      title: "Plan",
      body: "Your safety cushion, your milestones, and the long view.",
      utility:
        "What your own figures give if things carry on: the year ahead, the milestones your savings will pass and when, a safety cushion counted in months of fixed spending, and what each account could be worth later, after French tax. Nothing here moves any money.",
      steps: [
        {
          title: "See the year ahead",
          body: "Your accounts month by month over the next twelve, from what you have already planned. Slide to set a little more aside and watch the year end higher.",
        },
        {
          title: "Your safety cushion",
          body: "How many months of fixed spending your savings would cover if your income stopped.",
        },
        {
          title: "The long view",
          body: "What a savings account, a PEA, life insurance, a brokerage account, a PER or crypto could be worth in ten or twenty years, after the tax each pays in France. An estimate, and labelled as one.",
        },
      ],
    },
    {
      id: "wallets",
      title: "Investments",
      body: "PEA, life insurance, brokerage, PER, crypto — what you hold, and what it is made of.",
      utility:
        "Your investments, noted by you. Prices update their value on their own; there is no link to a broker, and no order ever leaves the app.",
      steps: [
        {
          title: "Note what you hold",
          body: "One account per wrapper, and each investment in it with what you put in. Prices arrive in euros, whatever currency they are quoted in.",
        },
        {
          title: "See what is inside",
          body: "Two funds can hold the same companies without saying so. What’s inside shows where your money really is — shares, bonds, gold, crypto — and, for funds, the countries, sectors and fees.",
        },
        {
          title: "Ask for a review",
          body: "An AI reads what is inside and says what it notices. It only names funds from a fixed list, and writes no figure of its own.",
        },
      ],
    },
    {
      id: "property",
      title: "Property",
      body: "Your home or a place you let — what it is worth today, what is left on the loan, and what is really yours.",
      utility:
        "A home is often your largest figure and the one you see least. Pluclair estimates its value from the sales recorded around it and follows the loan month by month, so the part that is yours is a number rather than a feeling. Owned as a couple, each of you sees their part of the deed.",
      steps: [
        {
          title: "Add it once",
          body: "The address, what you paid and when, the loan. Its monthly payment joins your recurring entries, so the month already counts it.",
        },
        {
          title: "See what it is worth",
          body: "An estimate from the sales recorded nearby, moved by how prices have changed since, with the range it sits in. You can put your own figure instead.",
        },
        {
          title: "Watch your part grow",
          body: "What is still owed comes down with each payment; the bar shows how much of the home is yours, and your net worth on the Plan counts it.",
        },
      ],
    },
    {
      id: "month-close",
      title: "Month close",
      body: "One balance a month, and Pluclair shows you what it never saw.",
      utility:
        "The one moment Pluclair asks for something it cannot work out itself: your real balance. Compared with what you noted, it shows the spending nobody wrote down.",
      steps: [
        {
          title: "Pick a day",
          body: "The same day each month — not necessarily the last: with a deferred debit card, the month’s card payments have not gone through yet.",
        },
        {
          title: "Copy one balance",
          body: "What your current account held that day, read off your bank’s app. The first close is a starting point; everything after is measured from it.",
        },
        {
          title: "See what it found",
          body: "Money spent without being noted, what you really kept, and whether the month stayed within your usual margin.",
        },
      ],
    },
    {
      id: "month-read",
      title: "Written reads",
      body: "A few sentences about your month or your investments. The words are the AI’s; every figure is Pluclair’s.",
      utility:
        "The other screens give you figures and lists. A read puts them together and says what stands out — without being allowed to invent a number. Useful in months where the totals look normal and something underneath is not. Written on your own OpenRouter account, with the model you choose — Mistral, ChatGPT or Claude — at your expense: a few cents each.",
      steps: [
        {
          title: "Ask for one",
          body: "A read is written when you press, never on its own: on your month, on a category, or on your investments.",
        },
        {
          title: "Read what it noticed",
          body: "Observations first, suggestions apart under their own heading. Each figure in the text is Pluclair’s, slotted in after the AI said which one it meant.",
        },
        {
          title: "Ask again when it ages",
          body: "Figures never go out of date; judgements do. When what is underneath has moved enough, the read says so and you can ask for a new one.",
        },
      ],
    },
  ],

  /** The header's two in-page links, and the feature pages' walk. */
  nav: {
    howItWorks: "How it works",
    privacy: "Your questions",
    previous: "Previous",
    next: "Next",
  },

  footer: {
    tagline:
      "Your income, spending, savings and investments in one place — checked every month against your bank.",
    copyright: "© 2026 Pluclair",
    imageCredit:
      "Earth imagery: NASA, Blue Marble Next Generation (Reto Stöckli).",
    disclaimer: "No advice. No ads. Pluclair never touches your money.",
  },

  cta: {
    getStarted: "Get started",
    signIn: "Sign in",
    openApp: "Open app",
    goToDashboard: "See where you stand",
  },
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
