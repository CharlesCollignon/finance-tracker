import type { Locale } from "@finance/core/i18n/locale";
import type { LegalDocument } from "./legal-copy";
import { entraideRulesCopyFr } from "./entraide-rules-copy.fr";

/**
 * « Les règles d'Entraide »: how members ask, answer and help each other,
 * how moderation works, and what happens to what they post — in English.
 *
 * A document of its own rather than sections of the terms and the privacy
 * policy, so those can be signed off now, before Entraide exists, and this
 * when it opens (`ENTRAIDE_RULES_DRAFT`, in `legal-status.ts`). Once
 * Entraide's code stores posts, the privacy policy and the terms each point
 * here in a line, in the same commit (as `legal-copy.ts` asks).
 *
 * Written for the duties of a host of other people's words: the Digital
 * Services Act's notices (art. 16), statements of reasons (art. 17) and
 * contact point (art. 12), and the LCEN. `[[…]]` marks what the operator
 * or a lawyer must settle (`docs/legal/ENTRAIDE.md`); `entraide-rules-copy.test.ts`
 * fails if one survives the switch to final.
 */
export interface EntraideRulesCopy {
  /** ISO date the text last changed. */
  updated: string;
  draftNotice: string;
  document: LegalDocument;
}

export const entraideRulesCopy: EntraideRulesCopy = {
  updated: "2026-10-13",
  draftNotice:
    "Draft for review: these rules apply once Entraide opens. Highlighted blanks are for the operator to fill in, and the text has not been checked by a lawyer yet.",
  document: {
    title: "Entraide's rules",
    summary:
      "How to ask, answer and help each other in Entraide: what is welcome, what is not, how moderation works, and what happens to what you post.",
    sections: [
      {
        id: "what",
        heading: "Entraide in short",
        body: [
          "Entraide is the place on pluclair.com where people who use Pluclair ask questions about their money and answer each other's. Anyone can read it, and search engines show it; asking, answering, reacting and reporting need a Pluclair account.",
          "Entraide only shows what members write in it. It never reads your figures in Pluclair: nothing from your account appears there unless you write it yourself.",
        ],
      },
      {
        id: "rules",
        heading: "The rules",
        body: ["In Entraide:"],
        points: [
          "answer with what you know, and say how you know it — a source, or your own experience;",
          "be kind: disagree with an idea, never with a person, and leave out insults, mockery and harassment;",
          "keep personal data out: no IBAN, account or card number, address, phone number or email address — yours or anyone else's;",
          "do not promote anything: no advertising, referral or sponsorship codes, affiliate links, or pitch for a product, a service or a paid group;",
          "never ask anyone for money, never offer to manage someone's money or take their bank details, and do not move a conversation elsewhere to do so;",
          "post nothing unlawful: no scam, no incitement to hatred or violence, nothing that infringes someone else's rights;",
          "do not pretend to be someone else — another member, a professional, or Pluclair;",
          "stay on subject: money in everyday life in France, and Pluclair.",
        ],
      },
      {
        id: "views",
        heading: "Members' views, not advice",
        body: [
          "What members write is their own view, shown as theirs. It is not advice from Pluclair, and nothing in Entraide is investment, tax, legal or credit advice.",
          "Answers from Pluclair itself carry the « Pluclair » mark. Like everything Pluclair writes, they explain how things work and do not tell you what to do. Before a decision that matters, check the official sources, or ask a professional.",
        ],
      },
      {
        id: "pseudonym",
        heading: "Your pseudonym",
        body: [
          "You choose a pseudonym the first time you post, and it is all that others see of you: never your name, never your email address. Choose one that does not identify you or anyone else, and does not pretend to be someone else.",
        ],
      },
      {
        id: "before",
        heading: "Before a post is published",
        body: [
          "Before a question or an answer is published, Pluclair masks anything in it that looks like an IBAN, a card number, an email address or a phone number, and shows you what it masked, so you can put it right before anything goes out.",
          "To keep Entraide free of spam, the number of posts per account per day is limited, and an account less than a day old cannot post links. Links in posts are marked as written by members, so search engines do not take them as Pluclair's.",
        ],
      },
      {
        id: "yours",
        heading: "What you post",
        body: [
          "What you write stays yours. By posting it, you allow Pluclair, free of charge and for as long as it stays in Entraide, to store it, show it to anyone who visits Entraide, and keep it in the conversation it belongs to — only to run Entraide, never to sell it or use it anywhere else. You are responsible for what you post, and you confirm you have the right to post it.",
          "You can edit or delete your questions and answers at any time. A deleted post is replaced by « Message supprimé », so the conversation around it still reads.",
        ],
      },
      {
        id: "moderation",
        heading: "How moderation works",
        body: [
          "Pluclair does not read posts before they appear. Any member can report a question or an answer that breaks these rules or the law (« Signaler »), saying why; the person reported is never told who reported them. The publisher reviews every report, and may hide a post, restore it, or bar a pseudonym from posting.",
          "When three different members report the same post, it is hidden automatically until the publisher has looked at it. Hiding is the usual measure: a hidden post is kept, not erased, so the decision can be reviewed. A pseudonym that keeps breaking the rules, or posts something clearly unlawful, can be barred from Entraide; the rest of the account is not affected.",
        ],
      },
      {
        id: "notices",
        heading: "Reporting unlawful content",
        body: [
          "Anyone, with or without an account, can report content they believe is unlawful by writing to pluclair.app@gmail.com. So that it can be acted on, a notice should give:",
        ],
        points: [
          "the address (URL) of the post;",
          "why you believe it is unlawful;",
          "your name and email address — not needed if the notice concerns child sexual abuse material;",
          "a statement that you believe, in good faith, that the notice is accurate and complete.",
        ],
        after: [
          "We acknowledge every notice, decide on it promptly, carefully and objectively, and tell you what we decided and how it can be challenged.",
        ],
      },
      {
        id: "reasons",
        heading: "When a post is hidden or a pseudonym barred",
        body: [
          "We tell the author, by email, at the latest when the measure takes effect:",
        ],
        points: [
          "what was done — a post hidden, a pseudonym barred — and for how long;",
          "the facts it rests on, and whether it followed a report or was our own decision;",
          "whether it was automatic, as when three reports hide a post;",
          "the rule of this page, or the law, that it applies;",
          "how to challenge it.",
        ],
      },
      {
        id: "challenge",
        heading: "Challenging a decision",
        body: [
          "You can challenge any decision about your post or your pseudonym, or about a notice you sent, by replying to the email that told you of it, within six months. A person — never a machine — looks at it again, and we tell you the outcome. You can also take the matter to the competent courts.",
        ],
      },
      {
        id: "host",
        heading: "Pluclair as a host",
        body: [
          "For what members post, Pluclair is a hosting provider within the meaning of the EU Digital Services Act (Regulation (EU) 2022/2065) and of French law no. 2004-575 of 21 June 2004 on confidence in the digital economy (LCEN). It does not check posts before they appear, and acts promptly to remove or block unlawful content once it is made aware of it. Where the law requires, it informs the authorities — of a post suggesting a threat to someone's life or safety, for example.",
          "Contact point for members and for the authorities (Digital Services Act, articles 11 and 12): pluclair.app@gmail.com, in French or in English.",
        ],
      },
      {
        id: "data",
        heading: "Your data in Entraide",
        body: [
          "For Entraide we keep your pseudonym, your questions and answers with their dates, your reactions, and the reports you make or that concern you. Anyone can see your pseudonym, your posts, their dates and the number of reactions; who reported a post is never shown.",
          "This is to run Entraide, which you ask for by posting (the agreement between us), and to moderate it and keep it lawful (our legitimate interest, and our duties as a host).",
        ],
        points: [
          "Your posts: until you delete them, or your account. Deleting your account replaces each of your posts with « Message supprimé » and erases its text; your pseudonym goes with it.",
          "Reports and moderation decisions: [[how long — for example one year after the decision]], to answer a challenge or an authority.",
          "What the law requires a host to keep about who posted what (the LCEN and decree no. 2021-1362 of 20 October 2021): [[which data, and for how long]].",
        ],
        after: [
          "Everything else in the privacy policy applies to Entraide: your rights, how to exercise them, and how to complain to the CNIL.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to these rules",
        body: [
          "When these rules change, the date at the top changes with them, and a change that matters is announced in Entraide before it takes effect.",
        ],
      },
    ],
  },
};

export function entraideRulesCopyFor(locale: Locale): EntraideRulesCopy {
  return locale === "fr" ? entraideRulesCopyFr : entraideRulesCopy;
}
