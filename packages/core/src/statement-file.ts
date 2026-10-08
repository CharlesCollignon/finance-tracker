import {
  detectDelimiter,
  looksLikeHeaderRow,
  parseCsv,
  parseCsvDate,
  rowNamesColumns,
  type CsvDelimiter,
} from "./csv-import";

/**
 * A bank's export, from the bytes of the file to a table the import's
 * mapping step reads: a CSV however its bank wrote it, or an OFX.
 *
 * Three things real French exports do that a plain CSV reader misses:
 *
 * - **Windows-1252.** Many banks still write their files in it, and read as
 *   UTF-8 every « é » becomes a question mark. The bytes are read as UTF-8
 *   when they are valid UTF-8, and as Windows-1252 otherwise.
 * - **Lines above the header.** The account's name, its number, the dates
 *   covered, a balance — then the column names. The header is the first row
 *   that names a date and an amount; what comes before it is dropped.
 * - **OFX.** BNP, Banque Populaire and Caisse d'Épargne, LCL, La Banque
 *   Postale and BoursoBank hand one out, in the old SGML form or as XML.
 *   Each transaction becomes a row — date, label, signed amount — under a
 *   header the mapping step recognises on its own.
 */

/** Windows-1252's 0x80–0x9F, where it parts from Latin-1. */
const WINDOWS_1252_HIGH: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

/** The code points of `bytes` read as UTF-8, or null where they are not. */
function utf8CodePoints(bytes: Uint8Array): number[] | null {
  const points: number[] = [];
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index]!;
    let length: number;
    let point: number;
    if (first < 0x80) {
      points.push(first);
      index += 1;
      continue;
    } else if (first >= 0xc2 && first <= 0xdf) {
      length = 2;
      point = first & 0x1f;
    } else if (first >= 0xe0 && first <= 0xef) {
      length = 3;
      point = first & 0x0f;
    } else if (first >= 0xf0 && first <= 0xf4) {
      length = 4;
      point = first & 0x07;
    } else {
      return null;
    }
    if (index + length > bytes.length) {
      return null;
    }
    for (let next = 1; next < length; next += 1) {
      const byte = bytes[index + next]!;
      if ((byte & 0xc0) !== 0x80) {
        return null;
      }
      point = (point << 6) | (byte & 0x3f);
    }
    // Overlong forms and surrogates are not UTF-8 either.
    const smallest = length === 2 ? 0x80 : length === 3 ? 0x800 : 0x10000;
    if (
      point < smallest ||
      point > 0x10ffff ||
      (point >= 0xd800 && point <= 0xdfff)
    ) {
      return null;
    }
    points.push(point);
    index += length;
  }
  return points;
}

/** Turns code points into a string without overflowing the call stack. */
function fromCodePoints(points: readonly number[]): string {
  let text = "";
  const CHUNK = 8192;
  for (let start = 0; start < points.length; start += CHUNK) {
    text += String.fromCodePoint(...points.slice(start, start + CHUNK));
  }
  return text;
}

/**
 * A file's text: UTF-8 when the bytes are valid UTF-8, Windows-1252
 * otherwise — what a French bank's export is when it is not UTF-8. A byte
 * order mark is dropped.
 */
export function decodeStatement(bytes: Uint8Array): string {
  const utf8 = utf8CodePoints(bytes);
  const points =
    utf8 ?? Array.from(bytes, (byte) => WINDOWS_1252_HIGH[byte] ?? byte);
  const text = fromCodePoints(points);
  return text.replace(/^﻿/, "");
}

/* -------------------------------------------------------------------- OFX */

/** Whether the text is an OFX file rather than a CSV. */
export function isOfx(text: string): boolean {
  const head = text.slice(0, 2000).toUpperCase();
  return head.includes("OFXHEADER") || head.includes("<OFX>");
}

/** One field of an OFX transaction: `<TAG>value`, closed or not. */
function ofxField(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  return match ? match[1]!.trim() : "";
}

/** `20261008`, `20261008120000[+1:CET]` → `2026-10-08`. */
function ofxDate(value: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

/** The column names an OFX's rows are given: ones the mapping recognises. */
export const OFX_HEADER = ["Date", "Libellé", "Montant"] as const;

/**
 * An OFX's transactions as rows of date, label and signed amount, under
 * `OFX_HEADER`. The label is the transaction's name, with its memo after it
 * when the memo says something the name does not.
 */
export function parseOfx(text: string): string[][] {
  const rows: string[][] = [[...OFX_HEADER]];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0] ?? raw;
    const name = ofxField(block, "NAME");
    const memo = ofxField(block, "MEMO");
    const label =
      memo && !name.toLowerCase().includes(memo.toLowerCase())
        ? [name, memo].filter(Boolean).join(" ")
        : name || memo;
    rows.push([
      ofxDate(ofxField(block, "DTPOSTED")),
      label,
      ofxField(block, "TRNAMT"),
    ]);
  }
  return rows;
}

/* ------------------------------------------------------------------ table */

/** How far down a file its header is looked for. */
const HEADER_SEARCH_ROWS = 25;

/**
 * The row that names the columns: the first, among the file's first rows,
 * that names a date and an amount (or a debit or credit) and is not itself a
 * line of data. Null when none does.
 */
export function findHeaderRow(rows: readonly string[][]): number | null {
  const limit = Math.min(rows.length, HEADER_SEARCH_ROWS);
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index]!;
    const dated = row.some((value) => parseCsvDate(value) !== null);
    if (!dated && rowNamesColumns(row)) {
      return index;
    }
  }
  return null;
}

export interface StatementTable {
  /** The rows from the header down, or every row when there is none. */
  table: string[][];
  /** Whether `table`'s first row is the column names. */
  hasHeader: boolean;
  format: "csv" | "ofx";
}

/**
 * A file's text as the import's table.
 *
 * For a CSV, the delimiter is the one under which a header is found — the
 * lines above a header often have fewer separators, which is what throws the
 * plain count off — and the lines above the header are dropped. Without a
 * header anywhere, the first row decides as it always has.
 */
export function readStatement(text: string): StatementTable {
  if (isOfx(text)) {
    return { table: parseOfx(text), hasHeader: true, format: "ofx" };
  }

  const candidates: CsvDelimiter[] = [detectDelimiter(text), ";", ",", "\t"];
  let best: { rows: string[][]; header: number } | null = null;
  for (const delimiter of new Set(candidates)) {
    const rows = parseCsv(text, delimiter);
    const header = findHeaderRow(rows);
    if (
      header !== null &&
      (best === null || rows[header]!.length > best.rows[best.header]!.length)
    ) {
      best = { rows, header };
    }
  }

  if (best) {
    return {
      table: best.rows.slice(best.header),
      hasHeader: true,
      format: "csv",
    };
  }

  const rows = parseCsv(text, detectDelimiter(text));
  return {
    table: rows,
    hasHeader: rows.length > 0 && looksLikeHeaderRow(rows[0]!),
    format: "csv",
  };
}
