import { DEFAULT_LOCALE, type Locale } from "./locale";
import { messages, type Messages } from "./messages";

/**
 * Looking up what the app says.
 *
 * Two things are worth knowing before reading this file.
 *
 * The first is that plural forms are selected by hand rather than by
 * `Intl.PluralRules`. Not for want of the API but because the app has already
 * learned twice over not to put a client-rendered string in Intl's hands: the
 * month tables in `../constants` are written out because Node and Chrome
 * disagree about "Sep", and `describePullAge` in `../bank-pull` refuses
 * `Intl.RelativeTimeFormat` for its own reasons. With exactly two languages,
 * the entire rule set is the fifteen lines of `pluralCategory` below, it is
 * unit-testable, and it behaves the same on Hermes as it does on Node.
 *
 * The second is that English is the fallback for a missing French string, and
 * a missing string in both is returned as its own key. A key on screen is
 * ugly and unmistakable, which is what you want from a bug; an exception
 * thrown while rendering a label is a blank page, which is not.
 */

/**
 * A message with more than one form.
 *
 * `one` and `other` are what English needs. French adds `many`, used for whole
 * millions — no ledger will hit it, but leaving it out would mean the type
 * could not express French, and a plural system that cannot express its own
 * languages is the ternaries this replaces with extra steps.
 */
export interface PluralMessage {
  one: string;
  other: string;
  many?: string;
}

export type Leaf = string | PluralMessage;

export type MessageTree = { [key: string]: Leaf | MessageTree };

/** Every dotted path that reaches a message, so a typo is a type error. */
export type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends Leaf
    ? K
    : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

export type Key = MessageKey<Messages>;

export type Vars = Record<string, string | number>;

export type Translate = (key: Key, vars?: Vars) => string;

type PluralCategory = "one" | "other" | "many";

/**
 * Which form of a plural message a count takes.
 *
 * The CLDR rules for the two languages, restricted to the integers a ledger
 * actually counts. Note that French puts zero in the singular — "0 charge",
 * not "0 charges" — which is the whole reason a `count === 1` ternary cannot
 * be translated, and the reason this function exists.
 */
export function pluralCategory(
  locale: Locale,
  count: number,
): PluralCategory {
  if (locale === "fr") {
    if (count === 0 || count === 1 || count === -1) {
      return "one";
    }
    if (Number.isInteger(count) && count !== 0 && count % 1_000_000 === 0) {
      return "many";
    }
    return "other";
  }

  return count === 1 || count === -1 ? "one" : "other";
}

function lookup(tree: MessageTree, key: string): Leaf | undefined {
  let node: Leaf | MessageTree | undefined = tree;

  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      return undefined;
    }
    node = (node as MessageTree)[segment];
    if (node === undefined) {
      return undefined;
    }
  }

  return typeof node === "string" || isPluralMessage(node) ? node : undefined;
}

function isPluralMessage(value: unknown): value is PluralMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PluralMessage).other === "string"
  );
}

/**
 * `{name}` and `{count}` filled in from `vars`.
 *
 * A placeholder with no matching variable is left as it stands rather than
 * blanked, so the gap says which variable is missing instead of hiding that
 * one was expected.
 */
function interpolate(template: string, vars: Vars | undefined): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

function resolve(locale: Locale, key: string, vars: Vars | undefined): string {
  const message =
    lookup(messages[locale], key) ??
    (locale === DEFAULT_LOCALE
      ? undefined
      : lookup(messages[DEFAULT_LOCALE], key));

  if (message === undefined) {
    return key;
  }

  if (typeof message === "string") {
    return interpolate(message, vars);
  }

  const count = vars?.count;
  if (typeof count !== "number") {
    // A plural message asked for without a count is a call site bug, not a
    // translation gap, so it reads as the plural rather than as the key: the
    // sentence still makes sense while the missing variable shows up as an
    // unfilled `{count}`.
    return interpolate(message.other, vars);
  }

  const category = pluralCategory(locale, count);
  const form =
    (category === "many" ? message.many : message[category]) ?? message.other;

  return interpolate(form, vars);
}

/**
 * The app's voice in one language.
 *
 * Returned as a function rather than exposed as `t(locale, key)` so it can be
 * injected the way `formatMoney` already is throughout `packages/core` — the
 * prose builders in `month-facts`, `push-digest` and `month-read-prompt` take
 * a formatter they do not choose, and they now take a translator the same way.
 * That is what keeps them pure and testable in both languages.
 */
export function translator(locale: Locale): Translate {
  return (key, vars) => resolve(locale, key, vars);
}

/**
 * Translate a string that may or may not be a message key.
 *
 * The one place a cast to `Key` is allowed, and it is safe for a reason that
 * is designed rather than lucky: `resolve` returns the key unchanged when
 * there is no message for it. So a key resolves, and anything else — a
 * sentence from Postgres, a network error, a word a caller composed itself —
 * passes through untouched.
 *
 * That property is what lets the Zod schemas in `../validations` carry keys
 * instead of sentences. A schema is built when its module loads, long before
 * any request has a language, so it cannot translate its own messages; it
 * emits a key, and the toast that shows it resolves it here. Every other
 * error travelling the same field arrives intact.
 *
 * Not for prose the app composed. If you know the key, call `t` and let the
 * type check it.
 */
export function resolveMessage(t: Translate, text: string): string {
  return t(text as Key);
}
