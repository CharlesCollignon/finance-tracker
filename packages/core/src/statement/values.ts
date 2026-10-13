import { parseCsvAmount } from "../csv-import";

/**
 * Cells read strictly: a date that is only a date, an amount that is only
 * an amount. What tells a file's columns apart when nothing names them — a
 * label that starts « 12/10 CB MONOP » is not a date, and « CARTE X1234 » is
 * not 1 234 €.
 */

/** An amount and nothing else: digits, separators, a sign, a currency. */
const AMOUNT_SHAPE =
  /^\s*[+-]?\s*\(?\s*[+-]?\s*(?:€|eur|\$|£)?\s*\d[\d\s  .,']*\s*\)?\s*(?:€|eur|euros?|\$|£|chf|usd|gbp)?\s*[+-]?\s*$/i;

/** The amount in `value` when the cell is an amount, else null. */
export function strictAmount(value: string): number | null {
  if (!AMOUNT_SHAPE.test(value) || !/\d/.test(value)) {
    return null;
  }
  const trailingMinus = /\d[\s ]*-\s*$/.test(value);
  const parsed = parseCsvAmount(value.replace(/'/g, ""));
  if (parsed === null) {
    return null;
  }
  return trailingMinus ? -Math.abs(parsed) : parsed;
}

/** `value` as a signed decimal string with two places, or null. */
export function decimalOf(value: number): string {
  return value.toFixed(2);
}

/* ----------------------------------------------------------------- dates */

const MONTHS: Record<string, number> = {
  jan: 1,
  janv: 1,
  janvier: 1,
  january: 1,
  fev: 2,
  fevr: 2,
  fevrier: 2,
  feb: 2,
  february: 2,
  mar: 3,
  mars: 3,
  march: 3,
  avr: 4,
  avril: 4,
  apr: 4,
  april: 4,
  mai: 5,
  may: 5,
  juin: 6,
  jun: 6,
  june: 6,
  juil: 7,
  juillet: 7,
  jul: 7,
  july: 7,
  aou: 8,
  aout: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  septembre: 9,
  september: 9,
  oct: 10,
  octobre: 10,
  october: 10,
  nov: 11,
  novembre: 11,
  november: 11,
  dec: 12,
  decembre: 12,
  december: 12,
};

/** Day before month, or month before day: decided once per column. */
export type DateOrder = "dmy" | "mdy";

function iso(year: number, month: number, day: number): string | null {
  const full = year < 100 ? (year < 70 ? 2000 + year : 1900 + year) : year;
  if (month < 1 || month > 12 || day < 1 || day > 31 || full < 1970) {
    return null;
  }
  const date = new Date(Date.UTC(full, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${full}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` for an Excel day number (1900 system), or null. */
export function excelSerialDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 25569 || serial > 73050) {
    return null;
  }
  // 25569 is 1 January 1970; Excel counts a 29 February 1900 that never was.
  const date = new Date(Math.round((Math.floor(serial) - 25569) * 86400000));
  return date.toISOString().slice(0, 10);
}

const NUMERIC_DATE =
  /^\s*(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\s*$/;
const COMPACT_DATE = /^\s*(\d{4})(\d{2})(\d{2})\s*$/;
const NAMED_DATE =
  /^\s*(?:[a-zé]+\.?,?\s+)?(\d{1,2})(?:er)?[\s-]+([a-zéû]+)\.?[\s-]+(\d{2,4})\s*$/i;
const NAMED_DATE_US = /^\s*([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})\s*$/i;

function monthNumber(word: string): number | null {
  const key = word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.$/, "");
  return MONTHS[key] ?? null;
}

/**
 * The date a cell holds when it holds only a date: `12/10/2026`, `12-10-26`,
 * `2026-10-12`, `2026-10-12 10:23:45`, `20261012`, « 12 oct. 2026 »,
 * « 1er octobre 2026 », « Oct 12, 2026 ». `order` settles `05/06/2026`.
 */
export function strictDate(
  value: string,
  order: DateOrder = "dmy",
): string | null {
  const numeric = NUMERIC_DATE.exec(value);
  if (numeric) {
    const [a, b, c] = [numeric[1]!, numeric[2]!, numeric[3]!];
    if (a.length === 4) {
      return iso(Number(a), Number(b), Number(c));
    }
    if (c.length === 4 || c.length === 2) {
      return order === "dmy"
        ? iso(Number(c), Number(b), Number(a))
        : iso(Number(c), Number(a), Number(b));
    }
    return null;
  }
  const compact = COMPACT_DATE.exec(value);
  if (compact) {
    return iso(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  }
  const named = NAMED_DATE.exec(value);
  if (named) {
    const month = monthNumber(named[2]!);
    return month ? iso(Number(named[3]), month, Number(named[1])) : null;
  }
  const us = NAMED_DATE_US.exec(value);
  if (us) {
    const month = monthNumber(us[1]!);
    return month ? iso(Number(us[3]), month, Number(us[2])) : null;
  }
  return null;
}

/**
 * Whether a column's dates are written day first or month first: month
 * first only when a cell says so (`10/25/2026`) and none says otherwise.
 * Day first, as every French bank writes, when nothing tells.
 */
export function dateOrderOf(cells: readonly string[]): DateOrder {
  let dayFirst = false;
  let monthFirst = false;
  for (const cell of cells) {
    const match = NUMERIC_DATE.exec(cell);
    if (!match || match[1]!.length === 4) {
      continue;
    }
    if (Number(match[1]) > 12) {
      dayFirst = true;
    }
    if (Number(match[2]) > 12) {
      monthFirst = true;
    }
  }
  return monthFirst && !dayFirst ? "mdy" : "dmy";
}
