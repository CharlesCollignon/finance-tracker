import { bankMerchantKey } from "./bank-merchant";

/**
 * « Règles de rangement »: the rules a person writes for filing a line.
 *
 * The feed files a line on its own only where the person's own history
 * answers for it (`bank-feed`): the same shop, filed the same way, twice.
 * That memory is learned and invisible — nobody can read it, and nobody can
 * say « tout ce qui contient NAVIGO va dans Transports » before the second
 * time. A filing rule is that sentence, written down: words to find in a
 * line, the category it goes to, and the way the money went. The planner
 * asks the rules before anything it learned, which is what commitment 2
 * promised — « a rule you wrote » — and what a learned memory could never
 * quite be.
 *
 * Pure: the rows are `@finance/data/filing-rules`'s; the matching is here,
 * so it is the same on the sync, the import and the phone.
 */

export type FilingDirection = "in" | "out";

export interface FilingRule {
  id: string;
  /** The words to find, as typed. */
  words: string;
  categoryId: string;
  categoryName: string;
  direction: FilingDirection;
  /** How many lines it filed. */
  appliedCount: number;
  /** The line that gave the rule, when it was written from one. */
  createdFrom: string | null;
}

/** The longest words a rule may hold; the column says the same. */
export const RULE_WORDS_MAX = 80;
export const RULE_WORDS_MIN = 2;

/**
 * The words as they are matched: no case, no accents, no punctuation, one
 * space between words. Applied to the rule and to the line alike, so
 * « Café Joyeux » finds « CAFE JOYEUX PARIS 11 ».
 */
export function normalizeRuleWords(words: string): string {
  return words
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** What a rule is matched against: the line's words, and the money's way. */
export interface FilingLine {
  note: string;
  counterparty: string | null;
  direction: FilingDirection;
}

/**
 * Whether a rule files this line: the money went its way, and its words
 * appear whole in the line's description or counterparty — « lidl » finds
 * « LIDL 1234 » and not « SLIDLE ».
 */
export function ruleMatches(
  rule: Pick<FilingRule, "words" | "direction">,
  line: FilingLine,
): boolean {
  if (rule.direction !== line.direction) {
    return false;
  }
  const words = normalizeRuleWords(rule.words);
  if (words.length < RULE_WORDS_MIN) {
    return false;
  }
  const haystacks = [line.note, line.counterparty ?? ""]
    .map(normalizeRuleWords)
    .filter((text) => text.length > 0);
  return haystacks.some((text) => ` ${text} `.includes(` ${words} `));
}

/**
 * The rule that files this line, if any. The most specific wins: a rule
 * with more words is tried before one with fewer, so « amazon prime » beats
 * « amazon » for the subscription and leaves the parcels to the shorter
 * rule.
 */
export function findFilingRule<
  R extends Pick<FilingRule, "words" | "direction">,
>(rules: readonly R[], line: FilingLine): R | null {
  const ordered = [...rules].sort(
    (a, b) =>
      normalizeRuleWords(b.words).length - normalizeRuleWords(a.words).length,
  );
  return ordered.find((rule) => ruleMatches(rule, line)) ?? null;
}

/**
 * The words to offer for a rule written from a line, or from a group of
 * the review named after its shop: the merchant as the matcher keys it
 * (`bankMerchantKey`), which drops the card noise, the branch and the
 * town — else the name itself, trimmed to what a rule may hold.
 */
export function suggestRuleWords(name: string): string {
  const key = bankMerchantKey(name);
  const words = key.length >= RULE_WORDS_MIN ? key : normalizeRuleWords(name);
  return words.slice(0, RULE_WORDS_MAX).trim();
}
