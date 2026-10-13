import { parseAskMarkdown, type AskInline } from "./ask-markdown";

/**
 * Entraide (« Le blog »'s community, migration 071): what a question, an
 * answer and a pseudonym may be, how a thread is addressed, and how it is
 * listed — the same rules the database holds, said here so a form can
 * answer before the write is refused.
 */

/** The limits migration 071 enforces, by its checks and its triggers. */
export const ENTRAIDE_LIMITS = {
  titleMin: 8,
  titleMax: 140,
  bodyMax: 5000,
  replyMin: 2,
  replyMax: 3000,
  handleMin: 3,
  handleMax: 24,
  /** Questions and shares, per account, over the last 24 hours. */
  postsPerDay: 5,
  /** Answers, per account, over the last 24 hours. */
  repliesPerDay: 30,
  /** How old an account must be before its posts may hold links. */
  linkAfterHours: 24,
} as const;

/** A question asks; a share tells (« Partages »). */
export type PostKind = "question" | "share";

/** The list's four doors: « Toutes · Sans réponse · Résolues · Partages ». */
export const ENTRAIDE_FILTERS = [
  "all",
  "unanswered",
  "solved",
  "shares",
] as const;
export type EntraideFilter = (typeof ENTRAIDE_FILTERS)[number];

/** « Récentes · Les plus utiles ». */
export const ENTRAIDE_SORTS = ["recent", "useful"] as const;
export type EntraideSort = (typeof ENTRAIDE_SORTS)[number];

export function isEntraideFilter(value: unknown): value is EntraideFilter {
  return (ENTRAIDE_FILTERS as readonly unknown[]).includes(value);
}

export function isEntraideSort(value: unknown): value is EntraideSort {
  return (ENTRAIDE_SORTS as readonly unknown[]).includes(value);
}

export type HandleProblem = "short" | "long" | "characters" | "reserved";

// Latin letters (accented too), digits, and . _ - inside; no spaces: the
// same as migration 071's check.
const HANDLE =
  /^[A-Za-z0-9À-ÖØ-öø-ÿŒœ](?:[A-Za-z0-9À-ÖØ-öø-ÿŒœ._-]*[A-Za-z0-9À-ÖØ-öø-ÿŒœ])?$/;

/**
 * Why a pseudonym cannot be taken, or null if it can. None may pass for
 * Pluclair: that mark is the owner's, on answers given as Pluclair.
 * Uniqueness, regardless of case, is the database's to say.
 */
export function handleProblem(handle: string): HandleProblem | null {
  const value = handle.trim();
  if (value.length < ENTRAIDE_LIMITS.handleMin) {
    return "short";
  }
  if (value.length > ENTRAIDE_LIMITS.handleMax) {
    return "long";
  }
  if (!HANDLE.test(value)) {
    return "characters";
  }
  if (
    foldAccents(value).toLowerCase().replace(/[._-]/g, "").includes("pluclair")
  ) {
    return "reserved";
  }
  return null;
}

export function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Whether a text holds a link, which a day-old account may not post. */
export function hasLink(text: string): boolean {
  return /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.[a-z]/i.test(text);
}

/** A thread's title as an address: plain letters, lower case, hyphens, short. */
export function threadSlug(title: string): string {
  return (
    foldAccents(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "question"
  );
}

export const ENTRAIDE_HREF = "/blog/entraide";

/** `/blog/entraide/42-comment-choisir-son-jour-de-lecture`. */
export function threadHref(id: number, title: string): string {
  return `${ENTRAIDE_HREF}/${id}-${threadSlug(title)}`;
}

/**
 * The thread's id from its address, whatever the words after it say — a
 * title edited since still finds its thread, and the page redirects to the
 * address as it is now. Null for anything that is not one.
 */
export function threadIdOf(param: string): number | null {
  const match = /^(\d{1,15})(?:-[a-z0-9-]*)?$/.exec(param);
  if (!match) {
    return null;
  }
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * « Les règles d'Entraide », by key: what a report says is broken, and the
 * rule a moderator's decision applies (migration 072's checks hold the same
 * list).
 */
export const ENTRAIDE_RULES = [
  "kind",
  "personal",
  "promotion",
  "money",
  "unlawful",
  "impersonation",
  "offtopic",
  "other",
] as const;
export type EntraideRule = (typeof ENTRAIDE_RULES)[number];

export function isEntraideRule(value: unknown): value is EntraideRule {
  return (ENTRAIDE_RULES as readonly unknown[]).includes(value);
}

/** What a reported or decided thing is: a question or share, or an answer. */
export type EntraideTarget = `post:${number}` | `reply:${number}`;

export function entraideTargetOf(value: string): EntraideTarget | null {
  return /^(post|reply):[1-9]\d{0,17}$/.test(value)
    ? (value as EntraideTarget)
    : null;
}

/**
 * A measure that restricts someone, as its author reads it: what was done,
 * the rule it applies, the facts, and how it came about (Digital Services
 * Act, art. 17).
 */
export interface EntraideDecision {
  target: EntraideTarget | null;
  action: "hide" | "restore" | "bar" | "unbar";
  rule: EntraideRule | "none";
  facts: string;
  automatic: boolean;
  fromReport: boolean;
  createdAt: string;
}

/** Who wrote a post or an answer, as anyone may see it. */
export interface EntraideAuthor {
  /** Null once the account is gone. */
  handle: string | null;
  /** The owner's mark: an answer given as Pluclair. */
  isPluclair: boolean;
  isMine: boolean;
}

export type EntraideStatus = "visible" | "hidden" | "deleted";

/** A question or a share in the list. */
export interface EntraidePostSummary {
  id: number;
  kind: PostKind;
  title: string;
  /** The start of the text, as written (Markdown and all). */
  excerpt: string;
  author: EntraideAuthor;
  /** Deleted, or its author's account is: « Message supprimé ». */
  gone: boolean;
  createdAt: string;
  lastActivityAt: string;
  replyCount: number;
  solved: boolean;
  usefulCount: number;
}

export interface EntraidePost {
  id: number;
  kind: PostKind;
  title: string;
  body: string;
  guideSlug: string | null;
  author: EntraideAuthor;
  /** "hidden" only ever reaches its own author. */
  status: EntraideStatus;
  gone: boolean;
  createdAt: string;
  editedAt: string | null;
  /** The answer the asker marked « Résolu », while it stands. */
  solvedReplyId: number | null;
}

export interface EntraideReply {
  id: number;
  body: string;
  author: EntraideAuthor;
  status: EntraideStatus;
  gone: boolean;
  createdAt: string;
  editedAt: string | null;
}

/** A thread that « Déjà demandé ? » offers. */
export interface EntraideMatch {
  id: number;
  kind: PostKind;
  title: string;
  replyCount: number;
  solved: boolean;
}

/**
 * What a refused write says, beyond the app's usual errors: the reasons
 * migration 071's triggers give, by name.
 */
export type EntraideError =
  | "entraide.noHandle"
  | "entraide.handleTaken"
  | "entraide.handleReserved"
  | "entraide.handleInvalid"
  | "entraide.banned"
  | "entraide.linksTooSoon";

function inlineText(nodes: readonly AskInline[]): string {
  return nodes
    .map((node) => ("children" in node ? inlineText(node.children) : node.text))
    .join("");
}

/**
 * A post's start as plain words, for a card in the list: its Markdown
 * read, its marks gone, cut at a word near `max` characters.
 */
export function excerptOf(markdown: string, max = 180): string {
  const text = parseAskMarkdown(markdown, [], { links: true })
    .map((block) => {
      switch (block.kind) {
        case "heading":
        case "paragraph":
        case "quote":
          return inlineText(block.inline);
        case "list":
          return block.items.map(inlineText).join(" · ");
        case "table":
          return block.rows
            .map((row) => row.map(inlineText).join(" "))
            .join(" ");
        case "rule":
          return "";
      }
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?—-]+$/, "")}…`;
}
