import type { Locale } from "./i18n/locale";

/**
 * The figures in an Ask Pluclair answer, and whether each came from the app
 * (`./ask-chat`).
 *
 * The model writes its own numbers now, so the app checks them after the
 * fact rather than forbidding them: every amount and every percentage in an
 * answer is looked for among the values the app handed over — the tools'
 * results, the calculator's, what the person wrote. One found nowhere is
 * marked on screen as the model's own, not dropped: an answer that loses
 * sentences silently reads as a broken one.
 *
 * Only amounts and percentages are checked. A count of months, a year or a
 * day of the month is too easily right by chance, or wrong without harm.
 */

export interface AskFigure {
  /** As written in the answer. */
  text: string;
  /** What it says, sign included. */
  value: number;
  unit: "money" | "percent";
  /**
   * How finely it is written: 0.01 for « 12,34 € », 1 for « 12 € », 100 for
   * « 1 200 € », 100 for « 1,2 k€ ». A figure rounded this far still matches.
   */
  step: number;
  /** Where it sits in the text it was read from. */
  index: number;
}

const NUMBER = String.raw`\d{1,3}(?:[   .,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;
const SIGN = String.raw`[-−+]?`;
const SCALE = String.raw`(?:\s?[kKM](?![a-zA-Z]))?`;
const CURRENCY_AFTER = String.raw`(?:€|EUR\b|euros?\b|\$|USD\b|£|GBP\b|CHF\b|dollars?\b)`;
const CURRENCY_BEFORE = String.raw`(?:€|\$|£|CHF\s?|EUR\s?|USD\s?|GBP\s?)`;

/**
 * An amount — a currency on either side, a k or an M between — or a
 * percentage, not glued to a word or another number.
 */
export const FIGURE_PATTERN = new RegExp(
  String.raw`(?<![\w.,])(?:` +
    String.raw`(${SIGN})${CURRENCY_BEFORE}\s?(${NUMBER})(${SCALE})` +
    String.raw`|(${SIGN})(${NUMBER})(${SCALE})\s?${CURRENCY_AFTER}` +
    String.raw`|(${SIGN})(${NUMBER})\s?%` +
    String.raw`)`,
  "g",
);

/** Every amount and percentage in a text, in order. */
export function figuresIn(text: string, locale: Locale): AskFigure[] {
  const figures: AskFigure[] = [];
  for (const match of text.matchAll(FIGURE_PATTERN)) {
    const percent = match[8] !== undefined;
    const sign = match[1] ?? match[4] ?? match[7] ?? "";
    const digits = match[2] ?? match[5] ?? match[8]!;
    const scale = (match[3] ?? match[6] ?? "").trim();
    const read = readNumber(digits, locale);
    if (!read) {
      continue;
    }
    const multiplier = scale === "M" ? 1e6 : scale ? 1e3 : 1;
    const negative = sign === "-" || sign === "−";
    figures.push({
      text: match[0],
      value: (negative ? -1 : 1) * read.value * multiplier,
      unit: percent ? "percent" : "money",
      step: read.step * multiplier,
      index: match.index,
    });
  }
  return figures;
}

/**
 * A number as a person writes it, in either language: « 1 234,56 »,
 * « 1,234.56 », « 1.234 », « 12,5 ». Its value, and how finely it is
 * written; null when it cannot be read.
 */
export function readNumber(
  written: string,
  locale: Locale,
): { value: number; step: number } | null {
  const compact = written.replace(/[   ]/g, " ");
  const separators = [...compact.matchAll(/[ .,]/g)].map((m) => m[0]);
  let decimal: string | null = null;
  if (separators.length > 0) {
    const last = separators.at(-1)!;
    const lastAt = compact.lastIndexOf(last);
    const after = compact.length - lastAt - 1;
    const kinds = new Set(separators);
    if (last === " ") {
      decimal = null;
    } else if (kinds.size > 1) {
      // Two kinds: the last one written is the decimal point.
      decimal = last;
    } else if (separators.length > 1) {
      // The same mark again and again groups thousands.
      decimal = null;
    } else if (after !== 3) {
      decimal = last;
    } else {
      // « 1,234 » or « 1.234 »: the language says which mark groups.
      decimal = (locale === "fr" ? "." : ",") === last ? null : last;
    }
  }
  const [whole, fraction = ""] = decimal
    ? [
        compact.slice(0, compact.lastIndexOf(decimal)),
        compact.slice(compact.lastIndexOf(decimal) + 1),
      ]
    : [compact, ""];
  const integer = whole.replace(/[ .,]/g, "");
  if (!/^\d+$/.test(integer) || !/^\d*$/.test(fraction)) {
    return null;
  }
  const value = Number(`${integer}.${fraction || "0"}`);
  if (!Number.isFinite(value)) {
    return null;
  }
  let step = fraction ? 10 ** -fraction.length : 1;
  if (!fraction && integer.length >= 3) {
    // « 1 200 » is written to the hundred: trailing zeros past the first
    // digit or two are rounding, not precision.
    const zeros = /0+$/.exec(integer)?.[0].length ?? 0;
    step = 10 ** Math.min(zeros, integer.length - 1);
  }
  return { value, step };
}

/** Every number in a text — figures or not — as values another may match. */
export function numbersIn(text: string, locale: Locale): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(new RegExp(NUMBER, "g"))) {
    const read = readNumber(match[0], locale);
    if (read) {
      values.push(read.value);
    }
  }
  for (const figure of figuresIn(text, locale)) {
    values.push(figure.value);
  }
  return values;
}

/** Every finite number in a value the app handed over, however deep. */
export function valuesIn(data: unknown): number[] {
  const values: number[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 12) {
      return;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      values.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, depth + 1);
      }
    } else if (value && typeof value === "object") {
      for (const item of Object.values(value)) {
        visit(item, depth + 1);
      }
    }
  };
  visit(data, 0);
  return values;
}

/**
 * Whether a figure is one of these values, as written: « 1 200 € » matches
 * 1 234,56, which it rounds; « 1 234,57 € » does not match 1 234,56. Signs
 * aside — « 450 € spent » is the app's −450.
 *
 * To the unit or finer, a figure may drop what follows (« 1 234 € » for
 * 1 234,56). Rounder than that, it must round to the value, and never by
 * more than a tenth of it: « 100 € » is not 140.
 */
export function figureMatches(
  figure: Pick<AskFigure, "value" | "step">,
  values: readonly number[],
): boolean {
  const target = Math.abs(figure.value);
  const tolerance =
    figure.step <= 1
      ? figure.step
      : Math.min(figure.step, Math.max(target * 0.1, 1)) / 2;
  // A hair over, so float noise never splits a match.
  const within = tolerance * 1.0001 + 1e-9;
  return values.some((value) => Math.abs(Math.abs(value) - target) < within);
}

/**
 * The figures of an answer that match none of the values it was written
 * from, as written: the screen marks them as the model's own.
 */
export function untracedFigures(
  answer: string,
  values: readonly number[],
  locale: Locale,
): string[] {
  const untraced = figuresIn(answer, locale)
    .filter((figure) => !figureMatches(figure, values))
    .map((figure) => figureKey(figure.text));
  return [...new Set(untraced)];
}

/** A figure's text with its spaces made one kind, to be found again. */
export function figureKey(text: string): string {
  return text.replace(/[\s  ]+/g, " ").trim();
}
