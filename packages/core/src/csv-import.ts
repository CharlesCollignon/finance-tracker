/**
 * A CSV's cells, and an amount however a bank writes it: what the statement
 * engine (`./statement`) reads a table with. Semicolon delimiters, quoted
 * cells holding line breaks, French number formatting.
 */

/* ------------------------------------------------------------------ parse */

const DELIMITERS = [",", ";", "\t"] as const;
export type CsvDelimiter = (typeof DELIMITERS)[number];

/**
 * Picks the delimiter that splits the first few lines most consistently.
 * Counting on one line alone is wrong for files whose description column
 * contains commas.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, 5);

  if (lines.length === 0) {
    return ",";
  }

  let best: CsvDelimiter = ",";
  let bestScore = -1;

  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => line.split(delimiter).length - 1);
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
      if (
        before.length <= 3 &&
        !before.includes(".") &&
        !before.includes(",")
      ) {
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
