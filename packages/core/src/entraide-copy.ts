import { formatFullDate, isoDateInAppTimeZone } from "./constants";
import type { EntraideError, EntraideRule } from "./entraide";
import { entraideCopyFr } from "./entraide-copy.fr";
import type { MaskKind } from "./entraide-mask";
import type { Locale } from "./i18n/locale";
import type { EntraideReaction } from "./reactions";

/**
 * The words around Entraide: its list, a thread, the forms. What members
 * write is theirs, in whatever language they write it; the frame is French
 * first, English for an English reader. `{count}`, `{kinds}` and the like
 * are filled in where the words are used.
 *
 * Here rather than in either app so the website and the phone say the same
 * thing — a rule named one way in a report and another in the decision
 * would be two rules.
 */
export interface EntraideCopy {
  meta: { title: string; description: string };
  hero: { title: string; intro: string; rules: string };
  filters: {
    label: string;
    all: string;
    unanswered: string;
    solved: string;
    shares: string;
  };
  sorts: { label: string; recent: string; useful: string };
  kinds: { question: string; share: string };
  composer: {
    pill: string;
    kindLabel: string;
    titleQuestion: string;
    titleShare: string;
    titlePlaceholder: string;
    bodyLabel: string;
    bodyPlaceholder: string;
    formatHint: string;
    handleLabel: string;
    handleHint: string;
    handleProblems: {
      short: string;
      long: string;
      characters: string;
      reserved: string;
    };
    preview: string;
    masked: string;
    maskKinds: Record<MaskKind, string>;
    already: string;
    guide: string;
    publish: string;
    publishing: string;
    cancel: string;
    agree: string;
    signIn: string;
    signInCta: string;
  };
  list: {
    empty: string;
    emptyFiltered: string;
    more: string;
    replies: { one: string; many: string };
    noReply: string;
    solved: string;
    gone: string;
    pluclair: string;
    edited: string;
  };
  thread: {
    back: string;
    answers: { one: string; many: string };
    noAnswers: string;
    views: string;
    replyLabel: string;
    replyPlaceholder: string;
    reply: string;
    replying: string;
    signIn: string;
    markSolved: string;
    unmarkSolved: string;
    solvedAnswer: string;
    edit: string;
    save: string;
    cancel: string;
    delete: string;
    confirmDelete: string;
    aboutGuide: string;
  };
  report: {
    button: string;
    title: string;
    note: string;
    send: string;
    sending: string;
    sent: string;
    signIn: string;
  };
  /** Each rule, as a report names it and a decision applies it. */
  rules: Record<EntraideRule, string>;
  decision: {
    hidden: string;
    automatic: string;
    moderator: string;
    afterReport: string;
    ownInitiative: string;
    facts: string;
    challenge: string;
  };
  moderation: {
    title: string;
    intro: string;
    empty: string;
    reports: { one: string; many: string };
    auto: string;
    question: string;
    answer: string;
    in: string;
    by: string;
    barred: string;
    keep: string;
    hide: string;
    bar: string;
    unbar: string;
    rule: string;
    facts: string;
    factsPlaceholder: string;
    confirm: string;
    cancel: string;
    done: string;
    mail: string;
    mailSubject: string;
    mailHidden: string;
    mailBarred: string;
    mailRule: string;
    mailFacts: string;
    mailHow: string;
    mailReport: string;
    mailOwn: string;
    mailChallenge: string;
  };
  when: { now: string; minutes: string; hours: string; yesterday: string };
  reactions: Record<EntraideReaction, string> & {
    label: string;
    signIn: string;
    signInCta: string;
    failed: string;
  };
  errors: Record<EntraideError, string> & {
    generic: string;
    tooManyAttempts: string;
    notAllowed: string;
    offline: string;
  };
}

export const entraideCopy: EntraideCopy = {
  meta: {
    title: "Entraide",
    description:
      "Questions about money in everyday life in France, asked and answered by the people who use Pluclair.",
  },
  hero: {
    title: "Entraide",
    intro:
      "Ask your questions about money in everyday life, and answer other people's. Each answer is its author's view, never advice from Pluclair.",
    rules: "Entraide's rules",
  },
  filters: {
    label: "Show",
    all: "All",
    unanswered: "Unanswered",
    solved: "Solved",
    shares: "Shares",
  },
  sorts: { label: "Order", recent: "Recent", useful: "Most useful" },
  kinds: { question: "Question", share: "Share" },
  composer: {
    pill: "Ask your question…",
    kindLabel: "This is",
    titleQuestion: "Your question",
    titleShare: "What you want to share",
    titlePlaceholder: "e.g. how do I choose my reading day?",
    bodyLabel: "The details (optional)",
    bodyPlaceholder:
      "Your situation, what you have already tried — never a bank detail.",
    formatHint: "**bold**, *italics*, lists and links",
    handleLabel: "Your pseudonym",
    handleHint:
      "It is all others will see of you. Chosen once: pick one that does not identify you.",
    handleProblems: {
      short: "At least 3 characters.",
      long: "At most 24 characters.",
      characters: "Letters, digits, and . _ - between them; no spaces.",
      reserved: "That one is Pluclair's.",
    },
    preview: "Preview",
    masked: "Before publishing, Pluclair will mask: {kinds}.",
    maskKinds: {
      iban: "an IBAN",
      card: "a card number",
      account: "a long number",
      email: "an email address",
      phone: "a phone number",
    },
    already: "Already asked?",
    guide: "Guide",
    publish: "Publish",
    publishing: "Publishing…",
    cancel: "Cancel",
    agree: "By publishing, you accept Entraide's rules.",
    signIn: "Sign in to ask a question or answer one.",
    signInCta: "Sign in",
  },
  list: {
    empty: "No question yet. Ask the first one.",
    emptyFiltered: "Nothing here for now.",
    more: "Show more",
    replies: { one: "1 answer", many: "{count} answers" },
    noReply: "No answer yet",
    solved: "Solved",
    gone: "Message deleted",
    pluclair: "Pluclair",
    edited: "edited",
  },
  thread: {
    back: "Entraide",
    answers: { one: "1 answer", many: "{count} answers" },
    noAnswers: "No answer yet. Yours could be the first.",
    views:
      "Each answer is its author's view, not advice from Pluclair. Answers marked « Pluclair » come from Pluclair itself.",
    replyLabel: "Your answer",
    replyPlaceholder: "What you know, and how you know it.",
    reply: "Answer",
    replying: "Sending…",
    signIn: "Sign in to answer.",
    markSolved: "Mark as solved",
    unmarkSolved: "Remove « Solved »",
    solvedAnswer: "The answer that solved it",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirmDelete:
      "Delete this message? It will be replaced by « Message deleted ».",
    aboutGuide: "About the guide",
  },
  report: {
    button: "Report",
    title: "What rule does it break?",
    note: "A detail (optional)",
    send: "Report",
    sending: "Sending…",
    sent: "Thank you, it is reported. Nobody but the publisher will know it was you.",
    signIn:
      "Sign in to report, or write to pluclair.app@gmail.com with the address of the message.",
  },
  rules: {
    kind: "Insult, mockery or harassment",
    personal: "Personal data",
    promotion: "Advertising or referral",
    money: "Asking for money, or a scam",
    unlawful: "Unlawful content",
    impersonation: "Pretends to be someone else",
    offtopic: "Off subject",
    other: "Something else",
  },
  decision: {
    hidden: "This message is hidden: only you can see it.",
    automatic:
      "Hidden automatically: three members reported it ({rule}). The publisher will look at it.",
    moderator: "Hidden by the publisher, for this rule: {rule}.",
    afterReport: "After a report.",
    ownInitiative: "On the publisher's own initiative.",
    facts: "What it rests on: {facts}",
    challenge:
      "You can challenge it within six months by writing to pluclair.app@gmail.com: a person looks at it again.",
  },
  moderation: {
    title: "Moderation",
    intro:
      "What members reported, the oldest first. Each decision is written down with its reason, which its author reads on the message; send them the same by email.",
    empty: "Nothing to look at.",
    reports: { one: "1 report", many: "{count} reports" },
    auto: "Hidden by three reports",
    question: "Question",
    answer: "Answer",
    in: "in",
    by: "by",
    barred: "barred",
    keep: "Keep",
    hide: "Hide",
    bar: "Bar the pseudonym",
    unbar: "Let the pseudonym back",
    rule: "The rule it breaks",
    facts: "The facts",
    factsPlaceholder:
      "What in it breaks the rule, in a sentence the author will read.",
    confirm: "Confirm",
    cancel: "Cancel",
    done: "Decided.",
    mail: "Send the reason by email",
    mailSubject: "Entraide: your message",
    mailHidden: "One of your messages in Entraide is hidden: {where}.",
    mailBarred: "Your pseudonym can no longer post in Entraide.",
    mailRule: "The rule it applies: {rule}.",
    mailFacts: "The facts: {facts}",
    mailHow: "The decision was taken {how}.",
    mailReport: "after a report",
    mailOwn: "on our own initiative",
    mailChallenge:
      "You can challenge this decision within six months by replying to this email: a person will look at it again. You can also take the matter to the competent courts.",
  },
  when: {
    now: "just now",
    minutes: "{count} min ago",
    hours: "{count} h ago",
    yesterday: "yesterday",
  },
  reactions: {
    label: "React",
    useful: "Useful",
    thanks: "Thanks",
    signIn: "Sign in to react.",
    signInCta: "Sign in",
    failed: "That did not go through. Try again in a moment.",
  },
  errors: {
    "entraide.noHandle": "Choose a pseudonym first.",
    "entraide.handleTaken": "That pseudonym is taken. Try another one.",
    "entraide.handleReserved": "That pseudonym is Pluclair's.",
    "entraide.handleInvalid":
      "Letters, digits, and . _ - between them; 3 to 24 characters.",
    "entraide.banned":
      "This pseudonym can no longer post in Entraide. You have been told why by email.",
    "entraide.linksTooSoon":
      "Links can be posted once your account is a day old. Remove the link, or come back tomorrow.",
    generic: "That could not be published. Try again in a moment.",
    tooManyAttempts:
      "That is the day's limit for this account. Come back tomorrow.",
    notAllowed: "That cannot be done on this message.",
    offline: "No connection. Your text is still here: try again.",
  },
};

export function entraideCopyFor(locale: Locale): EntraideCopy {
  return locale === "en" ? entraideCopy : entraideCopyFr;
}

/** An action's error key as the words to show. */
export function entraideErrorText(copy: EntraideCopy, key: string): string {
  if (key in copy.errors) {
    return copy.errors[key as EntraideError];
  }
  switch (key) {
    case "errors.tooManyAttempts":
      return copy.errors.tooManyAttempts;
    case "errors.notAllowed":
      return copy.errors.notAllowed;
    case "errors.offline":
      return copy.errors.offline;
    default:
      return copy.errors.generic;
  }
}

/** « 1 réponse », « 3 réponses ». */
export function countWords(
  words: { one: string; many: string },
  count: number,
): string {
  return count === 1 ? words.one : words.many.replace("{count}", String(count));
}

/** « à l'instant », « il y a 12 min », « hier », « 3 octobre ». */
export function entraideWhen(iso: string, now: Date, locale: Locale): string {
  const words = entraideCopyFor(locale).when;
  const at = new Date(iso);
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) {
    return words.now;
  }
  if (minutes < 60) {
    return words.minutes.replace("{count}", String(minutes));
  }
  if (minutes < 24 * 60) {
    return words.hours.replace("{count}", String(Math.floor(minutes / 60)));
  }
  if (minutes < 48 * 60) {
    return words.yesterday;
  }
  const day = isoDateInAppTimeZone(at);
  return day.slice(0, 4) === isoDateInAppTimeZone(now).slice(0, 4)
    ? formatFullDate(day, locale).replace(/ \d{4}$/, "")
    : formatFullDate(day, locale);
}
