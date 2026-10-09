import type { Locale } from "@finance/core/i18n/locale";
import { legalCopyFr } from "./legal-copy.fr";

export { LEGAL_DRAFT, legalPagesVisible } from "./legal-status";

/**
 * The privacy policy and the terms, in English.
 *
 * Written from what the app actually does — every table, every outside
 * service it calls, every retention it has — rather than from a template,
 * because a template describes some other app. When the code changes what is
 * stored, sent or kept, this file changes in the same commit.
 *
 * `[[…]]` marks what only the operator can supply or confirm: the legal
 * identity, the hosting regions, a backup window. Those are drawn as
 * highlighted blanks while the documents are drafts (`LEGAL_DRAFT`, in
 * `legal-status.ts`), and `legal-copy.test.ts` fails if any survives the
 * switch to final.
 */

export interface LegalSection {
  id: string;
  heading: string;
  /** Paragraphs, in order. */
  body: string[];
  /** A list after the paragraphs, when the section is a list. */
  points?: string[];
  /** Paragraphs after the list. */
  after?: string[];
}

export interface LegalDocument {
  title: string;
  /** One line under the title: what this document is for. */
  summary: string;
  sections: LegalSection[];
}

/** The three documents, and where each is served. */
export type LegalDocumentId = "privacy" | "terms" | "notice";

export const LEGAL_PATHS: Record<LegalDocumentId, string> = {
  privacy: "/privacy",
  terms: "/terms",
  // French, because the obligation is French (LCEN art. 1-1) and so is the
  // name everyone looks for.
  notice: "/mentions-legales",
};

export interface LegalCopy {
  nav: Record<LegalDocumentId, string>;
  updatedLabel: string;
  /** ISO date the text last changed. */
  updated: string;
  contents: string;
  draftNotice: string;
  privacy: LegalDocument;
  terms: LegalDocument;
  notice: LegalDocument;
}

export const legalCopy: LegalCopy = {
  nav: {
    privacy: "Privacy policy",
    terms: "Terms of use",
    notice: "Legal notice",
  },
  updatedLabel: "Last updated:",
  updated: "2026-10-04",
  contents: "On this page",
  draftNotice:
    "Draft for review. Highlighted blanks are for the operator to fill in, and the text has not been checked by a lawyer yet.",

  privacy: {
    title: "Privacy policy",
    summary:
      "What Pluclair holds about you, why, who helps run it, how long it is kept, and how to take it back.",
    sections: [
      {
        id: "who",
        heading: "Who we are",
        body: [
          'Pluclair is run by [[the operator\'s legal name — and, for a company, its legal form, registered office and registration number]] ("we", "us"). We are the controller of the personal data described here, except where a section says someone else is.',
          "For anything about your data, write to [[a privacy contact address]]. We answer within one month.",
        ],
      },
      {
        id: "short",
        heading: "The short version",
        body: [],
        points: [
          "Pluclair holds what you put in it, and what your bank sends if you choose to connect one. Nothing else.",
          "No advertising, no tracking across sites, and nothing is sold or shared for marketing. An audience measurement, made by us alone, counts the days the app is opened without naming you; you can turn it off in Profile.",
          "Connecting a bank is optional and read-only: nothing in Pluclair can move money.",
          "You can correct or delete any entry, disconnect your bank, or delete your account from the app, and deleting the account takes everything with it.",
        ],
      },
      {
        id: "what",
        heading: "What we hold",
        body: [],
        points: [
          "Your account: your email address and, if you sign in with Google, the name and account identifier Google shares with us. If you add a passkey we keep its public key; the private half never leaves your device.",
          "What you enter or import: transactions, categories, charges, caps, goals, wallets and their positions, month closes and the balances you record, tags and notes. When you import a bank export, the file is read to propose entries and only the entries you keep are stored; the file itself is not.",
          "Your preferences: language, and which invitations you have dismissed.",
          "The audience measurement, unless you turn it off: the days the app is opened, and how many times that day you added a transaction, closed a month or asked “Can I afford it?”. Under an identifier worked out from your account with a secret key, which does not name you. No amount, no shop, no text.",
          "Notifications, if you turn them on: the delivery address your browser or phone gives us (a push subscription, or a push token for the phone app), the browser's user agent, and a log of which reminders we have sent, so none is sent twice.",
          "Your properties, if you add any: what each cost and how it is used, its area and energy class, your share of it, the loans behind it and their terms, and what it is worth to you. Of its address we keep the town and the point it stands on, to compare it with the sales around it; the full address only if you ask us to.",
          "Your bank, if you connect one: see the next section.",
        ],
      },
      {
        id: "bank",
        heading: "Connecting a bank",
        body: [
          "Connecting a bank is optional. It works through your own open-banking.io account: you sign up there and pay them directly (at the time of writing, about €3 a month for the first account and €1 for each extra one), and your bank asks for your consent on its own pages, through Enable Banking Oy, a licensed account information service provider. Pluclair never sees your bank login, never collects or handles that payment, and is not itself a licensed or registered payment service provider.",
          "open-banking.io, Enable Banking and your bank process your data under their own privacy policies, as [[independent controllers — confirm with open-banking.io how they describe the roles]].",
          "To let Pluclair read that account, you give it the credentials file open-banking.io lets you download (credentials.json): an API key that reads your open-banking.io account, and the private key that decrypts what it returns. What Pluclair then receives:",
        ],
        points: [
          "For each account: its name, currency, and the balance the bank reports.",
          "For each movement: its date, amount, currency and direction, the bank's description, the merchant or payer where the bank names one, and the merchant category code where there is one.",
          "The connection's state, and when your bank's consent ends.",
        ],
        after: [
          "Of that file we keep only the two keys, sealed with AES-256-GCM under a key that only our server holds. No app can read that table — not even for your own account — and the keys are never sent back to a browser or phone, or written to a log. Your browser or phone carries the file once, to our server, and does not keep it.",
          "Pluclair asks your bank for new data only when you ask for a refresh; the rest of the time it reads what your open-banking.io account already holds. Your bank's consent lasts about 180 days; you renew it on open-banking.io, and we remind you before it ends.",
          "You can disconnect at any time from Profile → Bank. We delete the file straight away. Its API key keeps existing at open-banking.io until you delete it there, which the Bank page reminds you to do. You choose whether the entries your bank brought in stay in your records or are removed; they stay unless you say otherwise. Closing your open-banking.io account is done with them.",
        ],
      },
      {
        id: "why",
        heading: "Why we use it, and on what basis",
        body: [],
        points: [
          "To provide the service you signed up for: storing your records, working out your figures, showing them to you, and syncing your bank if you connected one. The legal basis is the contract between us (GDPR, article 6(1)(b)).",
          "For the bank connection, on the consent you give on screen when you upload your credentials file, and at your bank. It covers the sensitive information your transactions can reveal — health, beliefs, union membership — which is processed only on that explicit consent (articles 6(1)(a) and 9(2)(a)). We keep the date and the version of the words you accepted, and you withdraw it by disconnecting.",
          "To send notifications, only when you turn them on. Turning them off on your device or in your browser stops them.",
          "To know whether Pluclair is used: the audience measurement serves only to work out three overall figures — how many come back after a month, how many open it on several days a week, how many close their month — never to change what you see, and it is neither shared nor matched with anything else. The basis is our legitimate interest (article 6(1)(f)), and you object at any time by turning off “Audience measurement” in Profile.",
          "To keep the service secure and working: our host keeps short-lived technical logs of requests, and we look at them only to fix a fault or stop an abuse. The basis is our legitimate interest in running a safe service (article 6(1)(f)).",
        ],
        after: [
          "We never use your data for advertising, for marketing profiles, for credit scoring, or to make automated decisions that have legal or similarly significant effects on you.",
        ],
      },
      {
        id: "processors",
        heading: "Who helps us run it",
        body: [
          "These companies process data on our behalf, only to run Pluclair, and under a data processing agreement:",
        ],
        points: [
          "Supabase: the database and sign-in, in the European Union ([[the exact EU region of the Supabase project]]).",
          "Vercel: hosting for the website and the server, with the server functions running in Paris, France.",
          "OpenRouter (United States), only if you connect your own AI account: Pluclair has no AI model of its own, and reads and questions are written only by the model you chose, on your account and at your expense. OpenRouter receives the figures a read is written from — category names and monthly totals, the funds in a wallet and their values, the name and identifier of a fund to read — and, for a question asked in « Questions », the question as you typed it — what you write there reaches it as it is — with only the totals needed to answer it. It passes them to the model's provider (Mistral, OpenAI or Anthropic). Never your name, your email, your individual entries or your bank credentials. The account's key is kept encrypted on our server, and you can disconnect it at any time.",
          "Google: only if you sign in with Google.",
          "Notification delivery: web notifications are encrypted so that your browser's push service (Apple, Google, Microsoft or Mozilla, depending on the browser) cannot read them. Phone notifications go through Expo's push service and then Apple or Google.",
          "Market prices: to value your funds, we look up their prices from Yahoo Finance and from fund publishers' pages (justETF, iShares). We send only the fund's identifier, never anything about you.",
          "Address search: when you type a property's address, our server asks the French State's geocoding service (IGN Géoplateforme) to find it. IGN receives the address you typed, never your IP address or anything else about you. To estimate what a property is worth we read the public record of property sales (DVF) and the Notaires–INSEE price index, sending only a town code or the index's identifier. For a let property we download the ANIL's rent map whole, sending nothing about you.",
        ],
        after: [
          "Vercel Inc. is a US company certified under the EU–US Data Privacy Framework, on which any transfer to it relies. Supabase keeps the data in the European Union, and relies on the European Commission's standard contractual clauses for any access from outside it. [[Confirm each provider's current data processing agreement.]]",
          "If you connect an AI account, OpenRouter and the chosen model's provider may process those figures outside the European Union, most often in the United States: that transfer happens on your account, at your request, and you are told before you connect it.",
        ],
      },
      {
        id: "retention",
        heading: "How long we keep it",
        body: [],
        points: [
          "Your account and everything in it: for as long as you keep the account.",
          "A deleted entry: [[kept for 30 days so the deletion can be undone, then erased — the job that erases them is not scheduled yet]].",
          "When you delete your account (Profile → Delete account), your credentials file is deleted first, then everything is removed from the live database at once. Backups are overwritten within [[the backup retention of the Supabase plan]].",
          "Your credentials file: until you disconnect the bank, replace the file, or delete your account.",
          "The audience measurement: 13 months, then erased; deleting your account erases it at once.",
          "Your questions and their answers (« Questions »): 30 days, then erased; each can be deleted sooner, and deleting your account erases them at once.",
          "The log of reminders sent: for as long as the account exists, so none repeats.",
        ],
      },
      {
        id: "security",
        heading: "How it is protected",
        body: [
          "Every row is tied to its account and the database itself refuses to show it to anyone else (row-level security). All traffic is encrypted in transit. Bank keys are encrypted at rest under a key held apart from the database. Access to the production systems is limited to [[who has administrative access]].",
          "If a breach puts your data at risk, we will tell the CNIL within 72 hours and tell you without undue delay, as the law requires.",
        ],
      },
      {
        id: "rights",
        heading: "Your rights",
        body: [
          "You can ask to see the data we hold about you, have it corrected or erased, restrict or object to how it is used, receive it in a portable format, and withdraw any consent you gave. Most of this is in the app: edit or delete any entry, export a month of the Ledger as a CSV file, disconnect your bank, or delete your account. For anything else, write to [[the privacy contact address]].",
          "If you think we have not handled your data properly, you can complain to the CNIL (cnil.fr) or to the data protection authority where you live.",
        ],
      },
      {
        id: "children",
        heading: "Children",
        body: [
          "Pluclair is not meant for anyone under 15, the age of digital consent in France, and we do not knowingly hold data about them.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        body: [
          "When this policy changes, the date at the top changes with it. If a change affects what we hold about you or who sees it, we will tell you in the app before it takes effect.",
        ],
      },
    ],
  },

  terms: {
    title: "Terms of use",
    summary:
      "The agreement between you and Pluclair: what the service is, what it is not, and what each of us can expect.",
    sections: [
      {
        id: "about",
        heading: "About these terms",
        body: [
          "These terms are an agreement between you and [[the operator's legal name]], who runs Pluclair. By creating an account you accept them. The privacy policy explains how your data is handled, and is part of this agreement.",
        ],
      },
      {
        id: "service",
        heading: "The service",
        body: [
          "Pluclair keeps a record of your personal finances: what comes in and goes out, what repeats, what you set aside and invest, and how each month closes. It works out figures from what you enter, import, or let your bank send.",
          "Pluclair is free. If that ever changes, nothing you use today will start costing money without your explicit agreement. Features may change over time; we try to tell you before one you rely on goes away.",
        ],
      },
      {
        id: "account",
        heading: "Your account",
        body: [
          "You must be at least 15 and use a real email address you can receive mail at. An account is for one person. Keep your sign-in methods to yourself; what is done with your account is your responsibility, so tell us straight away at [[a support contact address]] if you think someone else has used it.",
        ],
      },
      {
        id: "data",
        heading: "Your data",
        body: [
          "What you put in Pluclair stays yours. You allow us to store and process it only as far as running the service needs. You can export a month of the Ledger at any time, and delete your account whenever you like.",
        ],
      },
      {
        id: "bank",
        heading: "Connecting a bank",
        body: [
          "Connecting a bank is optional and goes through your own open-banking.io account, a separate service. You sign up with them, accept their terms and pay them directly; Pluclair is not part of that contract, never takes or handles that payment, and is not a licensed or registered payment service provider — the account information service is provided by Enable Banking Oy. You connect it by giving Pluclair the credentials file of that account and consenting on screen: keep the file private, and delete its API key at open-banking.io if you think it has been exposed.",
          "The connection is read-only: nothing in Pluclair can move money. Syncing depends on open-banking.io, Enable Banking and your bank, and it can be late, incomplete, or stop — when your bank's consent ends, when your open-banking.io wallet runs out, or when a bank is unavailable. We tell you when syncing stops, and your records stay yours whatever happens to the connection.",
        ],
      },
      {
        id: "advice",
        heading: "Not financial advice",
        body: [
          "The figures in Pluclair are arithmetic on the data you and your bank provide, and they are only as right as that data. Pluclair gives no investment, tax, legal or credit advice, and the short reads it writes with the help of an AI model can contain mistakes: they are always shown next to the figures they come from, so check them there. Decisions about your money remain yours.",
        ],
      },
      {
        id: "use",
        heading: "Fair use",
        body: ["Please do not:"],
        points: [
          "try to reach another person's data, or get around the limits the service puts on access;",
          "overload the service, or read it with automated tools other than the apps we provide;",
          "use it for anything unlawful.",
        ],
        after: [
          "If an account breaks these rules, we may suspend it. Unless the situation is urgent or the law prevents it, we will tell you first and give you a chance to explain.",
        ],
      },
      {
        id: "availability",
        heading: "Availability",
        body: [
          "We work to keep Pluclair available and your data safe, but we cannot promise it will never be interrupted: maintenance, faults and outages at the services it relies on can all make it unavailable for a while.",
        ],
      },
      {
        id: "liability",
        heading: "Liability",
        body: [
          "As far as the law allows, we are not liable for indirect losses, or for decisions you make based on the figures Pluclair shows. Nothing in these terms limits the rights consumer law gives you, or our liability for gross negligence, fraud, or anything else the law does not let us exclude.",
        ],
      },
      {
        id: "ending",
        heading: "Ending the agreement",
        body: [
          "You can stop at any time by deleting your account from Profile. If we ever close Pluclair, we will tell you at least [[30 days]] ahead, and leave you the means to export your records first.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to these terms",
        body: [
          "If these terms change in a way that matters, we will tell you in the app at least [[30 days]] before the change takes effect. If you do not accept it, you can delete your account before then; continuing to use Pluclair afterwards means you accept the new terms.",
        ],
      },
      {
        id: "law",
        heading: "Applicable law and disputes",
        body: [
          "These terms are governed by French law. If something goes wrong, write to us first at [[the support contact address]] and we will try to put it right. [[If the operator is a business dealing with consumers: name the consumer mediator here, whom you can contact free of charge.]] You can also bring a claim before the competent French courts, or those where you live if the law gives you that right.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        body: [
          "[[The operator's legal name and postal address]]. Email: [[the support contact address]].",
        ],
      },
    ],
  },

  notice: {
    title: "Legal notice",
    summary:
      "Who publishes Pluclair, who hosts it, and who provides the regulated part of the bank connection.",
    sections: [
      {
        id: "publisher",
        heading: "Publisher",
        body: [
          "The pluclair.com website and the Pluclair apps are published by [[the publisher's full name — or, for a company, its name, legal form and share capital]], [[home address or registered office]], telephone [[a telephone number]], email [[a contact email address]]. [[Registration number (SIREN / RCS) if the publisher is registered; otherwise remove this sentence]].",
        ],
      },
      {
        id: "director",
        heading: "Publication director",
        body: ["[[Name of the publication director — usually the publisher]]."],
      },
      {
        id: "hosting",
        heading: "Hosting",
        body: [
          "The website and its servers are hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States, telephone [[Vercel's telephone number]]. Pluclair's server functions run in Paris, France.",
          "The app's data is stored by [[Supabase's legal name and address]], in the European Union ([[the exact EU region of the Supabase project]]).",
        ],
      },
      {
        id: "payments",
        heading: "Payment services",
        body: [
          "Pluclair is not a licensed or registered payment service provider. The optional bank connection goes through the user's own open-banking.io account (Tatic ApS, Denmark), and the account information service is provided by Enable Banking Oy, registered with the Finnish Financial Supervisory Authority (FIN-FSA).",
        ],
      },
      {
        id: "data",
        heading: "Personal data",
        body: [
          "How Pluclair handles personal data, and how to exercise your rights, is set out in the privacy policy.",
        ],
      },
    ],
  },
};

export function legalCopyFor(locale: Locale): LegalCopy {
  return locale === "fr" ? legalCopyFr : legalCopy;
}
