/**
 * Keypad-driven amount entry, shared by the web and mobile quick-add sheets.
 *
 * The value is kept as the raw string the user has typed ("", "12", "12.",
 * "12.5") rather than a number, because a number cannot represent a
 * half-finished entry: "12." and "12" are the same number but different
 * states of typing, and collapsing them makes the decimal key feel broken.
 */

export type AmountKey =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "."
  | "backspace"
  | "clear";

/** Enough for any personal-finance amount; stops the display overflowing. */
export const AMOUNT_MAX_INTEGER_DIGITS = 9;

const AMOUNT_MAX_FRACTION_DIGITS = 2;

const DIGITS = new Set([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
]);

/** True for the keys a numeric keypad can send, so callers can validate input. */
export function isAmountKey(value: string): value is AmountKey {
  return DIGITS.has(value) || value === "." || value === "backspace" || value === "clear";
}

function appendDigit(current: string, digit: string): string {
  const dot = current.indexOf(".");

  if (dot === -1) {
    // A lone leading zero is a placeholder, not a digit the user wants kept.
    if (current === "0") {
      return digit === "0" ? "0" : digit;
    }
    if (current.length >= AMOUNT_MAX_INTEGER_DIGITS) {
      return current;
    }
    return current + digit;
  }

  const fraction = current.length - dot - 1;
  if (fraction >= AMOUNT_MAX_FRACTION_DIGITS) {
    return current;
  }

  return current + digit;
}

/** Applies one keypress to the raw entry string. */
export function pressAmountKey(current: string, key: AmountKey): string {
  if (key === "clear") {
    return "";
  }

  if (key === "backspace") {
    return current.slice(0, -1);
  }

  if (key === ".") {
    if (current.includes(".")) {
      return current;
    }
    return current === "" ? "0." : `${current}.`;
  }

  return appendDigit(current, key);
}

/**
 * Accepts a pasted or typed string (web keyboards can produce anything) and
 * returns the closest valid entry string.
 */
export function sanitizeAmountInput(value: string): string {
  let result = "";

  for (const char of value.replace(",", ".")) {
    if (!isAmountKey(char)) {
      continue;
    }
    result = pressAmountKey(result, char);
  }

  return result;
}

/** The number the entry represents. Incomplete entries round down sensibly. */
export function amountInputToNumber(value: string): number {
  if (value === "" || value === ".") {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Whether the entry is a saveable amount — the app has no zero transactions. */
export function isAmountInputComplete(value: string): boolean {
  return amountInputToNumber(value) > 0;
}

/** Turns an existing amount back into an entry string, for the edit case. */
export function amountToInput(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export interface AmountDisplay {
  /** Grouped integer part, e.g. "1 234". */
  integer: string;
  /** Fraction including its separator while typing, e.g. "." or ".50". */
  fraction: string;
  /** True while nothing has been typed, so callers can dim the placeholder. */
  empty: boolean;
}

/**
 * Splits the entry for display. The integer and fraction come back separately
 * so the sheet can set the cents at a smaller size without re-parsing, and the
 * trailing "." stays visible so pressing the decimal key does something.
 */
export function formatAmountInput(
  value: string,
  locale = "fr-FR",
): AmountDisplay {
  if (value === "") {
    return { integer: "0", fraction: "", empty: true };
  }

  const dot = value.indexOf(".");
  const rawInteger = dot === -1 ? value : value.slice(0, dot);
  const rawFraction = dot === -1 ? null : value.slice(dot + 1);

  const integer = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(Number.parseInt(rawInteger || "0", 10));

  const separator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";

  return {
    integer,
    fraction: rawFraction === null ? "" : `${separator}${rawFraction}`,
    empty: false,
  };
}
