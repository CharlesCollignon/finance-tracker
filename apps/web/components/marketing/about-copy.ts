import type { Locale } from "@finance/core/i18n/locale";
import { aboutCopyFr } from "@/components/marketing/about-copy.fr";

/**
 * Every word on the about page: who makes Pluclair, why, what it costs, and
 * how to try the beta.
 *
 * Written in the first person, by the owner, and held to the site's three
 * rules (`landing-copy.ts`), with two more that this page needs:
 *
 *   Only what is true and checkable. The dates in the run are the
 *   repository's own (the first commit, the merges that opened each part);
 *   no invented figure, user count or quote.
 *
 *   "Free" is said exactly. Pluclair is free; the two options are paid to
 *   their own services, never to Pluclair, and their prices sit beside the
 *   word — French consumer law treats a "free" that hides a cost as
 *   misleading (Code de la consommation, L121-4).
 */

export const ABOUT_HREF = "/a-propos";

/** The repository, public: anyone can read what the app does with data. */
export const SOURCE_URL = "https://github.com/CharlesCollignon/finance-tracker";

export interface AboutCopy {
  meta: { title: string; description: string };
  hero: {
    status: string;
    titleLines: string[];
    intro: string;
    name: string;
    portraitAlt: string;
    place: string;
  };
  /** Lit word by word as it is read, like the landing's promise. */
  why: string;
  letter: { heading: string; paragraphs: string[]; signature: string };
  hats: {
    heading: string;
    intro: string;
    items: { title: string; body: string }[];
  };
  run: {
    heading: string;
    note: string;
    items: { date: string; title: string; body: string }[];
  };
  bill: {
    heading: string;
    intro: string;
    optional: string;
    rows: {
      label: string;
      detail: string;
      amount: string;
      optional: boolean;
    }[];
    totalLabel: string;
    footnote: string;
  };
  beta: {
    heading: string;
    body: string;
    download: string;
    downloadMeta: string;
    web: string;
    openApp: string;
    notYet: string;
    stepsHeading: string;
    steps: string[];
    iphone: string;
    /** After it, to the download page's iPhone section. */
    iphoneHow: string;
  };
  elsewhere: {
    heading: string;
    source: { title: string; detail: string };
    write: { title: string };
  };
}

export const aboutCopy: AboutCopy = {
  meta: {
    title: "About",
    description:
      "Charles Collignon, an engineering manager in Paris, built Pluclair to see where the money goes. Free, in open beta.",
  },

  hero: {
    status: "Open beta · Android and web",
    titleLines: ["Hello,", "I'm Charles."],
    intro:
      "Engineering manager — product and design — at a macroeconomics start-up in Paris. And, alongside it, I build Pluclair.",
    name: "Charles Collignon",
    portraitAlt:
      "Charles Collignon, smiling, holding up a can outside a convenience store",
    place: "Paris, 2026",
  },

  why: "I didn't build Pluclair to make money. I built it to know where mine goes.",

  letter: {
    heading: "Why Pluclair",
    paragraphs: [
      "I wanted to see in one place what comes in, what goes out, what I set aside and what I invest — and to check every month that the figures agree with my bank. So I built it.",
      "I use it every day, for my own accounts. It is the best way I know of finding out whether something works.",
      "Pluclair has nothing to sell you: no ads, no product placed in front of you, and your data is sold to nobody. If it helps you see more clearly, it has done its job.",
    ],
    signature: "Charles",
  },

  hats: {
    heading: "Three trades in one app",
    intro:
      "By day, I get engineers, product and design working together. On Pluclair, I hold all three.",
    items: [
      {
        title: "Engineering",
        body: "A website, a phone app and one codebase shared between them, so the figures are the same everywhere.",
      },
      {
        title: "Product",
        body: "Above all, deciding what stays out: no score, no ads, nothing to buy. What is left has to earn its place every week.",
      },
      {
        title: "Design",
        body: "A dark ground and one bright colour: the colour of the figure that matters. Everything else stays quiet.",
      },
    ],
  },

  run: {
    heading: "Four months, from the first line to the beta",
    note: "Nearly 900 changes to the code since June, every one of them readable on GitHub.",
    items: [
      {
        date: "15 June 2026",
        title: "The first line of code",
        body: "A dashboard, categories, and the entries that come back every month.",
      },
      {
        date: "23 July 2026",
        title: "The phone app",
        body: "The same account in your pocket, with the same figures.",
      },
      {
        date: "11 August 2026",
        title: "It is called Pluclair",
        body: "Your money, clearer every month.",
      },
      {
        date: "2 September 2026",
        title: "The bank, read-only",
        body: "A month is closed against the bank's balance, and what slipped through shows up.",
      },
      {
        date: "2 October 2026",
        title: "Property",
        body: "A home, its loans, and the share of it that is already yours.",
      },
      {
        date: "9 October 2026",
        title: "As a couple",
        body: "A shared space for the joint account, and each keeps their own.",
      },
      {
        date: "10 October 2026",
        title: "Questions, a real conversation",
        body: "Ask “where does my money go?” and keep digging from there.",
      },
      {
        date: "Today",
        title: "Open beta",
        body: "Open to everyone, free, and still being built.",
      },
    ],
  },

  bill: {
    heading: "The bill",
    intro:
      "Pluclair is free. One option alone is paid apart, directly to its own service — never to me.",
    optional: "Optional",
    rows: [
      {
        label: "Pluclair",
        detail: "The website, the app, every feature",
        amount: "€0",
        optional: false,
      },
      {
        label: "The AI of your choice",
        detail: "Your own OpenRouter account · Mistral, ChatGPT or Claude",
        amount: "a few cents a question",
        optional: true,
      },
    ],
    totalLabel: "What Pluclair takes",
    footnote:
      "No commission on either service: Pluclair never sees or handles those payments.",
  },

  beta: {
    heading: "Try the beta",
    body: "An open beta: everything works and I use it every day, but things are still moving. If something is off, write to me — I'm the one who reads it.",
    download: "Download for Android",
    downloadMeta: "APK file · free · no store",
    web: "Start on the web",
    openApp: "Open Pluclair",
    notYet:
      "The Android app arrives here very soon. Until then, Pluclair works in your phone's browser.",
    stepsHeading: "Installing on Android",
    steps: [
      "Open this page on your phone and download the file.",
      "Android asks you to let your browser install apps: allow it, once.",
      "If a warning mentions an unknown app, choose “Install anyway”. Updates install over it, and your data stays.",
    ],
    iphone:
      "On iPhone there is no app yet: Pluclair goes on the home screen from Safari, with the same account.",
    iphoneHow: "How",
  },

  elsewhere: {
    heading: "Find me",
    source: { title: "The code", detail: "Readable by anyone, on GitHub" },
    write: { title: "Write to me" },
  },
};

export function aboutCopyFor(locale: Locale): AboutCopy {
  return locale === "en" ? aboutCopy : aboutCopyFr;
}
