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
 *   — the bank connection, the mobile app until a store has it —
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
   * « Il vous reste »: the figure the app opens on, put together on the page
   * the way the app works it out — the accounts, less the charges due before
   * the next pay, less a margin for what is never written down. The figures
   * are the sample month's (`landing-sample.ts`, `leftToSpend`).
   */
  figure: {
    heading: "One figure, every morning",
    body: "What your accounts hold, less the charges due before your next pay, less a margin for what you never write down. Worked out again with every spend you note.",
    title: "You have",
    until: "until {date}",
    perDay: "so {amount} a day",
    balance: "In your accounts",
    charges: "Charges until {date}",
    marge: "Margin for the unrecorded",
    note: "Arithmetic on what you planned. Never advice.",
  },

  /**
   * The month on a phone, a chapter a screen: the pinned section where the
   * phone turns as the page scrolls. Each chapter names the screen it shows.
   * The phone is the web app in a phone's browser — the app itself is under
   * "Coming soon".
   */
  story: {
    heading: "How it works",
    body: "On your phone, Pluclair opens in the browser and sits on your home screen like an app.",
    chapters: [
      {
        id: "bearing",
        title: "Where you stand, at a glance",
        body: "The Overview opens on what is left until your next pay, and where the month will end once everything planned has gone out.",
      },
      {
        id: "ledger",
        title: "A spend, in a few taps",
        body: "The amount and the shop: Pluclair finds the category it went in last time. Or import your bank’s CSV or OFX file.",
      },
      {
        id: "charges",
        title: "What repeats, written for you",
        body: "Rent, salary, subscriptions: noted once, they fill in every month — and a subscription whose price goes up is flagged.",
      },
      {
        id: "month-close",
        title: "The month, checked against your bank",
        body: "Once a month, copy the balance your bank shows. What left without a trace — cash, a forgotten card — appears, in euros.",
      },
      {
        id: "questions",
        title: "Ask, in your own words",
        body: "“How much on groceries this month?” The answer comes with Pluclair’s own figures, written by the AI of your choice — never advice.",
      },
    ],
  },

  /** The desktop screens, a gallery that runs sideways as the page scrolls. */
  gallery: {
    heading: "On a bigger screen",
    body: "The same account on your computer, with room for the long view.",
    items: [
      { id: "wallets", caption: "What your funds are really made of" },
      { id: "plan", caption: "Your cushion, and the milestones ahead" },
      { id: "property", caption: "Your home, and how much of it is yours" },
      { id: "month-read", caption: "Your month, put into words" },
    ],
  },

  /**
   * What sits around the month: a grid of the rest, each a sentence, the
   * ones with a page of their own leading to it.
   */
  more: {
    heading: "And everything around it",
    items: [
      {
        id: "together",
        title: "For two",
        body: "A shared space for the joint account. Each of you sees what you share — never the other’s own money.",
        link: "See the shared space",
      },
      {
        id: "questions",
        title: "Questions",
        body: "Ask about your money in words. The AI of your choice answers with Pluclair’s figures, on your own account.",
        link: "See Questions",
      },
      {
        id: "year",
        title: "Your year",
        body: "Every January, your year in figures — to keep, or to share as an image.",
        link: "",
      },
      {
        id: "search",
        title: "Every month at once",
        body: "Find a shop, an amount or a category across all your months. Subscriptions are found on their own.",
        link: "",
      },
      {
        id: "alerts",
        title: "The Monday recap",
        body: "Your week in one notification, and a warning before an overdraft.",
        link: "",
      },
      {
        id: "privacy",
        title: "Blurred in one tap",
        body: "Every amount hidden at once — on the train, at the office.",
        link: "",
      },
    ],
  },

  /** What is built and not open to everyone yet. Future tense, here only. */
  soon: {
    heading: "Coming soon",
    items: [
      {
        id: "bank",
        title: "Your bank, connected",
        body: "Read-only: your transactions will arrive on their own, and Pluclair will never be able to make a payment.",
      },
      {
        /** Leaves this list for `phone` below once a store has the app. */
        id: "app",
        title: "The mobile app",
        body: "Pluclair in your pocket, with the same figures as on your computer.",
      },
    ],
  },

  /**
   * The phone app, once the App Store or Google Play has it
   * (`lib/store-links.ts`); until then it is under "Coming soon".
   */
  phone: {
    heading: "On your phone",
    body: 'The same account and the same figures, wherever you are. On Android, "You have" sits on your home screen, with a + to note a spend.',
    appStore: "App Store",
    googlePlay: "Google Play",
  },

  /** The worries a first visit has, answered plainly. Anchored as #privacy. */
  faq: {
    heading: "Your questions",
    items: [
      {
        question: "Can we use it as a couple?",
        answer:
          "Yes. Invite your partner into a shared space for the joint account: you both see what you share, each keeps a personal space the other never sees, and you choose how the joint spending splits.",
      },
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
        "Two figures at the top: what is in your account now, and where it will stand at the end of the month. Under them, the month as a curve, then a few cards — what you have spent, what is still to go out, where it went — each leading to the screen that holds its figures.",
      steps: [
        {
          title: "Read the two figures",
          body: "Today’s balance, and the end of the month once everything already planned has gone out. The second is simple arithmetic on what you planned, not a guess at what you might spend.",
        },
        {
          title: "See the month as a line",
          body: "Your balance day by day, solid up to today and dotted after it, with its lowest point still to come. Above it, what is left until pay day, and how much that is a day.",
        },
        {
          title: "Follow a card to where it comes from",
          body: "Spent, still to come, where it went: each card leads with an arrow to the screen that holds its figures, so nothing is counted twice.",
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
          body: "Every account, month by month, from what you have already planned, and why the money ends up there. Slide to set a little more aside in the account you choose, and watch the year end higher.",
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
    {
      id: "questions",
      title: "Questions",
      body: "Ask about your money in your own words.",
      utility:
        "Type a question the way it comes to you. Pluclair picks the figures it needs, the AI of your choice writes a few sentences, and every number in them is Pluclair’s own. On your own AI account, and never advice.",
      steps: [
        {
          title: "Ask it your way",
          body: "“How much on groceries this month?”, “What is my biggest subscription?” — the question as it comes. A shop is answered with its rows and their total.",
        },
        {
          title: "Pluclair’s figures, the AI’s words",
          body: "The AI never writes a number: it names a figure and Pluclair puts in its own. A sentence that would invent one, or tell you what to do, is removed.",
        },
        {
          title: "On your own account",
          body: "Connect an OpenRouter account once and choose Mistral, ChatGPT or Claude: each question costs a few cents, paid to OpenRouter. Conversations are kept 30 days.",
        },
      ],
    },
    {
      id: "together",
      title: "Shared space",
      body: "A joint account, shared — and your own money kept your own.",
      utility:
        "Invite your partner into a shared space: the joint account, its charges, its months and a home you own together. Each of you keeps a personal space the other never sees.",
      steps: [
        {
          title: "Invite with a link",
          body: "Send a link; your partner joins the space, and the joint account’s rows land there rather than in either of your own months.",
        },
        {
          title: "Me, or shared",
          body: "Switch between your money and the shared space in one tap. Each row says who added it, and either of you can close the joint month.",
        },
        {
          title: "Your share",
          body: "Set how the joint spending splits — half each, or otherwise — and see your spending with your part of the joint one.",
        },
      ],
    },
  ],

  /**
   * Each feature page's own hands-on part: a heading, a line saying what to
   * do, and the words its demo needs. The figures are the demos' own, in
   * `feature/demos/`.
   */
  demos: {
    bearing: {
      heading: "Can I afford it?",
      hint: "Slide an amount: the figure answers at once. Nothing is saved.",
    },
    ledger: {
      heading: "It files itself",
      hint: "Tap a shop: Pluclair finds its category, the way it did last time.",
      shops: [
        { shop: "Carrefour", category: "Groceries" },
        { shop: "SNCF", category: "Transport" },
        { shop: "Le Bistrot", category: "Eating out" },
        { shop: "Netflix", category: "Subscriptions" },
      ],
      added: "Added today",
    },
    charges: {
      heading: "The month fills itself",
      hint: "Scroll: each recurring entry lands on its day.",
      left: "Left each month",
    },
    "month-close": {
      heading: "What slipped through",
      hint: "Drag the balance your bank shows: the gap is what left without a trace.",
      expected: "What your rows say",
      bank: "What your bank shows",
      gap: "Left without a trace",
      none: "Nothing slipped through",
    },
    "month-read": {
      heading: "Every figure is Pluclair’s",
      hint: "Point at a figure: it comes from your own rows, never from the AI.",
      sentence:
        "Groceries are at {groceries} with twelve days to go, inside your margin of {marge}, and housing is still {housing}.",
      sources: {
        groceries: "Groceries, March",
        marge: "Your margin for the unrecorded",
        housing: "Rent, every month",
      },
      from: "From",
    },
    plan: {
      heading: "Your money, account by account",
      hint: "Pick a window, set a little more aside, choose where: every account moves with it.",
      note: "Nothing is moved: this is the Plan’s arithmetic on a sample month.",
    },
    wallets: {
      heading: "What one fund really holds",
      hint: "An MSCI World ETF, opened up.",
      fund: "MSCI World ETF",
      countriesTab: "Countries",
      sectorsTab: "Sectors",
      countries: [
        "United States",
        "Japan",
        "United Kingdom",
        "Canada",
        "France",
        "Elsewhere",
      ],
      sectors: [
        "Technology",
        "Financials",
        "Health",
        "Industrials",
        "Consumer",
        "Everything else",
      ],
      envelopes: {
        heading: "Every envelope, its own rules",
        hint: "Pick a card: what Pluclair keeps for it, and what tax takes in 2026.",
        inApp: "In Pluclair",
        tax: "Tax, in 2026",
        items: {
          pea: {
            name: "PEA",
            full: "Share savings plan",
            badge: "{ceiling}",
            badgeLabel: "ceiling on payments",
            inApp:
              "The ceiling is read on what you paid in, not on what it is worth, and the day you opened it starts the five-year clock.",
            tax: "After five years, no income tax on the gains: only social contributions, {rate}.",
            paidIn: "Paid in",
            of: "of {ceiling}",
            left: "{amount} of room left",
            clock: "Five years",
            opened: "Opened on {date}",
          },
          av: {
            name: "Life insurance",
            full: "Euro funds and unit-linked funds",
            badge: "8 years",
            badgeLabel: "to its tax break",
            inApp:
              "Funds with a price follow it on their own; a euro fund, you note its value. The long view estimates what is left after tax.",
            tax: "After eight years, {allowance} of gains a year free of income tax ({couple} for a couple), then {rate}. Social contributions stay at {social}.",
            progress: "Year {count} of eight",
            allowance: "of gains a year free of income tax, once it is eight",
            couple: "{amount} for a couple",
          },
          cto: {
            name: "CTO",
            full: "Ordinary brokerage account",
            badge: "Any currency",
            badgeLabel: "priced in euros",
            inApp:
              "Shares and funds from anywhere: their prices arrive in euros, whatever the currency, and update on their own.",
            tax: "No ceiling and no clock: a flat {rate} on gains and dividends.",
            quotes: ["A US share", "A UK share", "A Swiss share"],
          },
          per: {
            name: "PER",
            full: "Retirement savings plan",
            badge: "Deductible",
            badgeLabel: "from your taxable income",
            inApp:
              "What you paid in and what it is worth today. The long view estimates what is left after tax.",
            tax: "Payments come off your taxable income, within the ceiling printed on your tax notice. The money stays in until retirement, bar a few exceptions such as buying your home.",
            paid: "Paid in, {year}",
            total: "Over the year",
          },
          crypto: {
            name: "Crypto",
            full: "Bitcoin",
            badge: "BTC",
            badgeLabel: "noted in bitcoin",
            inApp:
              "Note what you hold in bitcoin: its value in euros follows the price.",
            tax: "{rate} on gains, and nothing in a year when your sales come to {exemption} or less.",
            flip: "Flip the coin",
            price: "1 BTC = {price}",
          },
          livret: {
            name: "Livret A",
            full: "And the other livrets",
            badge: "{rate}",
            badgeLabel: "a year, tax-free",
            inApp:
              "Each livret’s balance, rate and ceiling, and the interest it should pay this year.",
            tax: "No tax at all on a Livret A, an LDDS or an LEP. Payments stop at the ceiling: {ceiling} for a Livret A.",
            balance: "Balance",
            interest: "{amount} of interest a year",
          },
        },
      },
    },
    property: {
      heading: "How much of it is yours",
      hint: "Slide through the years of the loan.",
      yours: "Yours",
      owed: "Still owed",
      year: "In {year}",
    },
    questions: {
      heading: "Ask it your way",
      hint: "Pick a question.",
      third: "How much do I have left?",
      thirdAnswer: "You have {left} until {date}, so {perDay} a day.",
    },
    together: {
      heading: "Your share",
      hint: "Drag the split: each part of the joint spending follows.",
      spent: "Joint spending this month",
    },
  },

  /** The header's two in-page links, and the feature pages' walk. */
  nav: {
    howItWorks: "How it works",
    privacy: "Your questions",
    previous: "Previous",
    next: "Next",
    /** The product menu's three groups of pages. */
    groupMonth: "Your month",
    groupWealth: "Your wealth",
    groupMore: "And also",
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
