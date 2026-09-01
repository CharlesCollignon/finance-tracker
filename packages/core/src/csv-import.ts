/**
 * Reading a bank statement export.
 *
 * Pluclair does not connect to a bank, but every European bank hands out a CSV
 * on request — so this is the closest honest equivalent: the user downloads the
 * file, the app reads it, and the user confirms what it found. Nothing here
 * talks to a bank; it is a parser plus a set of guesses the user can override.
 *
 * The guesses have to survive real exports, which means: semicolon delimiters,
 * French number formatting, day-first dates, separate debit and credit
 * columns, and headers in either language.
 */

import { normalizeMerchant } from "./merchant-memory";
import type { CategoryType } from "./types/database";

/* ------------------------------------------------------------------ parse */

const DELIMITERS = [",", ";", "\t"] as const;
export type CsvDelimiter = (typeof DELIMITERS)[number];

/**
 * Picks the delimiter that splits the first few lines most consistently.
 * Counting on one line alone is wrong for files whose description column
 * contains commas.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "").slice(0, 5);

  if (lines.length === 0) {
    return ",";
  }

  let best: CsvDelimiter = ",";
  let bestScore = -1;

  for (const delimiter of DELIMITERS) {
    const counts = lines.map(
      (line) => line.split(delimiter).length - 1,
    );
    const first = counts[0] ?? 0;

    if (first === 0) {
      continue;
    }

    // Consistency across lines matters more than raw count.
    const consistent = counts.every((count) => count === first);
    const score = first * (consistent ? 10 : 1);

    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }

  return best;
}

/** RFC 4180 parse: quoted fields, escaped quotes, newlines inside quotes. */
export function parseCsv(text: string, delimiter?: CsvDelimiter): string[][] {
  const sep = delimiter ?? detectDelimiter(text);
  // A BOM survives most exports and would poison the first header cell.
  const input = text.replace(/^\ufeff/, "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;

  function endField() {
    row.push(field.trim());
    field = "";
  }

  function endRow() {
    endField();
    // Drop rows that are entirely empty — trailing newlines are universal.
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
    row = [];
  }

  while (index < input.length) {
    const char = input[index];

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }

    if (char === sep) {
      endField();
      index += 1;
      continue;
    }

    if (char === "\n") {
      endRow();
      index += 1;
      continue;
    }

    if (char === "\r") {
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field !== "" || row.length > 0) {
    endRow();
  }

  return rows;
}

/* ----------------------------------------------------------------- values */

/**
 * Reads an amount out of any of the formats a bank export uses.
 *
 * The separator ambiguity ("1,234" is a thousand in English and one-and-a-bit
 * in French) is resolved by position: whichever of "." or "," comes last is
 * the decimal separator, unless it is followed by exactly three digits and
 * occurs more than once, which only grouping does.
 */
export function parseCsvAmount(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  // Accountants wrap negatives in parentheses.
  const parenthesised = /^\((.*)\)$/.test(trimmed);
  let working = parenthesised ? trimmed.replace(/^\(|\)$/g, "") : trimmed;

  const negative = parenthesised || working.includes("-");

  // Strip currency symbols, spaces (including the narrow no-break kind French
  // uses for grouping), and the sign — the sign is tracked separately.
  working = working.replace(/[^\d.,]/g, "");

  if (working === "") {
    return null;
  }

  const lastComma = working.lastIndexOf(",");
  const lastDot = working.lastIndexOf(".");

  let decimalAt = -1;

  if (lastComma === -1 && lastDot === -1) {
    decimalAt = -1;
  } else if (lastComma > lastDot) {
    decimalAt = lastComma;
  } else {
    decimalAt = lastDot;
  }

  if (decimalAt !== -1) {
    const fractionLength = working.length - decimalAt - 1;
    const separator = working[decimalAt];
    const occurrences = working.split(separator).length - 1;

    // Three trailing digits with the separator repeated is grouping, not cents.
    if (fractionLength === 3 && occurrences > 1) {
      decimalAt = -1;
    }
    // A single separator with three digits after it and nothing else is
    // ambiguous ("1.234"); grouping is the far more common intent in exports.
    else if (fractionLength === 3 && occurrences === 1 && decimalAt > 0) {
      const before = working.slice(0, decimalAt);
      if (before.length <= 3 && !before.includes(".") && !before.includes(",")) {
        decimalAt = -1;
      }
    }
  }

  const digitsOnly =
    decimalAt === -1
      ? working.replace(/[.,]/g, "")
      : `${working.slice(0, decimalAt).replace(/[.,]/g, "")}.${working.slice(
          decimalAt + 1,
        )}`;

  const parsed = Number.parseFloat(digitsOnly);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return negative ? -parsed : parsed;
}

const TWO_DIGIT_YEAR_PIVOT = 70;

function isoFrom(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const full = year < 100 ? (year < TWO_DIGIT_YEAR_PIVOT ? 2000 + year : 1900 + year) : year;
  const date = new Date(Date.UTC(full, month - 1, day));
  // Rejects 31 February and friends rather than silently rolling forward.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${full}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Reads a date, preferring day-first, which is what every European export
 * uses. An unambiguous ISO date is detected by its four-digit leading year.
 */
export function parseCsvDate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(trimmed);
  if (iso) {
    return isoFrom(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(trimmed);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = Number(dayFirst[3]);

    // Only fall back to month-first when day-first is impossible.
    if (day > 12 || month <= 12) {
      const asDayFirst = isoFrom(year, month, day);
      if (asDayFirst) {
        return asDayFirst;
      }
    }
    return isoFrom(year, day, month);
  }

  return null;
}

/* ---------------------------------------------------------------- mapping */

export interface ColumnMapping {
  date: number;
  description: number;
  /** Single signed amount column. */
  amount: number | null;
  /** Split columns, used when the export has no single amount column. */
  debit: number | null;
  credit: number | null;
}

const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  date: ["date", "date operation", "date de operation", "operation date", "booking date", "value date", "date valeur", "transaction date"],
  description: ["description", "libelle", "libelle operation", "label", "details", "detail", "narrative", "reference", "merchant", "payee", "nature"],
  amount: ["amount", "montant", "montant eur", "value", "somme", "betrag", "importo"],
  debit: ["debit", "withdrawal", "depense", "sortie", "paid out", "money out"],
  credit: ["credit", "deposit", "recette", "entree", "paid in", "money in"],
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumn(headers: string[], hints: string[]): number | null {
  const normalized = headers.map(normalizeHeader);

  for (const hint of hints) {
    const exact = normalized.indexOf(hint);
    if (exact !== -1) {
      return exact;
    }
  }

  for (const hint of hints) {
    const partial = normalized.findIndex((header) => header.includes(hint));
    if (partial !== -1) {
      return partial;
    }
  }

  return null;
}

/**
 * Best guess at which column is which. Everything it returns is a starting
 * point for the mapping step in the UI, never a decision made on the user's
 * behalf — a wrong guess that silently imports is much worse than no guess.
 */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const debit = findColumn(headers, HEADER_HINTS.debit);
  const credit = findColumn(headers, HEADER_HINTS.credit);
  const amount = findColumn(headers, HEADER_HINTS.amount);

  return {
    date: findColumn(headers, HEADER_HINTS.date) ?? 0,
    description: findColumn(headers, HEADER_HINTS.description) ?? 1,
    amount,
    // Split columns only apply when there is no single amount column.
    debit: amount !== null ? null : debit,
    credit: amount !== null ? null : credit,
  };
}

/** True when the first row is labels rather than data. */
export function looksLikeHeaderRow(row: string[]): boolean {
  if (row.length === 0) {
    return false;
  }
  const parsableAsDate = row.some((cell) => parseCsvDate(cell) !== null);
  const parsableAsAmount = row.filter(
    (cell) => parseCsvAmount(cell) !== null,
  ).length;

  return !parsableAsDate && parsableAsAmount === 0;
}

/* ------------------------------------------------------------------- rows */

export type ImportRowStatus = "ready" | "duplicate" | "invalid";

export interface ImportRow {
  /** Index in the source file, so the UI can point at the offending line. */
  line: number;
  occurredOn: string | null;
  description: string;
  /** Always positive — the sign lives in `type`. */
  amount: number | null;
  type: CategoryType;
  /** Category guessed from merchant memory, if any. */
  categoryId: string | null;
  categoryName: string | null;
  status: ImportRowStatus;
  /** Why the row cannot be imported, when status is "invalid". */
  problem: string | null;
}

export interface ExistingTransactionKey {
  occurredOn: string;
  amount: number;
  note: string | null;
}

export interface BuildImportRowsOptions {
  mapping: ColumnMapping;
  /** Rows already in the ledger, so a re-import doesn't double everything. */
  existing?: ExistingTransactionKey[];
  /** Category guesser, normally bound to the user's merchant index. */
  guessCategory?: (
    description: string,
  ) => { categoryId: string; categoryName: string; categoryType: CategoryType } | null;
  /**
   * Which sign the export uses for money leaving the account. Nearly every
   * bank uses negative, but a few "expenses" exports are positive-only.
   */
  expenseSign?: "negative" | "positive";
}

/** date + amount + merchant, which is as close to an identity as a line has. */
function dedupeKey(occurredOn: string, amount: number, description: string): string {
  return `${occurredOn}|${amount.toFixed(2)}|${normalizeMerchant(description)}`;
}

function cell(row: string[], index: number | null): string {
  if (index === null || index < 0 || index >= row.length) {
    return "";
  }
  return row[index] ?? "";
}

/**
 * Turns parsed CSV rows into reviewable import rows.
 *
 * Every row comes back, including the broken ones — the user needs to see that
 * three lines were skipped and why, rather than wonder where they went.
 */
export function buildImportRows(
  rows: string[][],
  options: BuildImportRowsOptions,
): ImportRow[] {
  const { mapping, existing = [], guessCategory, expenseSign = "negative" } = options;

  const seen = new Set(
    existing.map((row) =>
      dedupeKey(row.occurredOn, Math.abs(Number(row.amount)), row.note ?? ""),
    ),
  );

  return rows.map((row, index) => {
    const line = index + 1;
    const description = cell(row, mapping.description).trim();

    const occurredOn = parseCsvDate(cell(row, mapping.date));

    let signed: number | null = null;

    if (mapping.amount !== null) {
      signed = parseCsvAmount(cell(row, mapping.amount));
    } else {
      const debit = parseCsvAmount(cell(row, mapping.debit));
      const credit = parseCsvAmount(cell(row, mapping.credit));
      if (debit !== null && debit !== 0) {
        signed = -Math.abs(debit);
      } else if (credit !== null && credit !== 0) {
        signed = Math.abs(credit);
      }
    }

    const base: ImportRow = {
      line,
      occurredOn,
      description,
      amount: signed === null ? null : Math.abs(signed),
      type: "expense",
      categoryId: null,
      categoryName: null,
      status: "ready",
      problem: null,
    };

    if (occurredOn === null) {
      return { ...base, status: "invalid", problem: "No readable date" };
    }

    if (signed === null || signed === 0) {
      return { ...base, status: "invalid", problem: "No readable amount" };
    }

    const isExpense =
      expenseSign === "negative" ? signed < 0 : signed > 0;
    const type: CategoryType = isExpense ? "expense" : "income";
    const amount = Math.abs(signed);

    const guess = guessCategory?.(description) ?? null;
    // A remembered category only applies when it agrees on direction —
    // "Salary" must never be attached to an outgoing line.
    const usable = guess && guess.categoryType === type ? guess : null;

    const key = dedupeKey(occurredOn, amount, description);
    const duplicate = seen.has(key);
    if (!duplicate) {
      seen.add(key);
    }

    return {
      ...base,
      occurredOn,
      amount,
      type,
      categoryId: usable?.categoryId ?? null,
      categoryName: usable?.categoryName ?? null,
      status: duplicate ? "duplicate" : "ready",
      problem: duplicate ? "Already in your ledger" : null,
    };
  });
}

export interface ImportSummary {
  ready: number;
  duplicate: number;
  invalid: number;
  /** Ready rows that still need a category chosen before they can be saved. */
  needsCategory: number;
  total: number;
}

export function summarizeImportRows(rows: ImportRow[]): ImportSummary {
  return rows.reduce<ImportSummary>(
    (summary, row) => ({
      ready: summary.ready + (row.status === "ready" ? 1 : 0),
      duplicate: summary.duplicate + (row.status === "duplicate" ? 1 : 0),
      invalid: summary.invalid + (row.status === "invalid" ? 1 : 0),
      needsCategory:
        summary.needsCategory +
        (row.status === "ready" && row.categoryId === null ? 1 : 0),
      total: summary.total + 1,
    }),
    { ready: 0, duplicate: 0, invalid: 0, needsCategory: 0, total: 0 },
  );
}
