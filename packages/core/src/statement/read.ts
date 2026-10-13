import { detectDelimiter, parseCsv, type CsvDelimiter } from "../csv-import";
import { decodeStatement } from "../statement-file";
import type { BankId } from "./banks";
import { isCamt, readCamt } from "./camt";
import { isCfonb, readCfonb } from "./cfonb";
import type { Statement, StatementBlock, StatementFormat } from "./model";
import { isMt940, readMt940 } from "./mt940";
import { isOfx, readOfx } from "./ofx";
import { isQif, readQif } from "./qif";
import {
  htmlTable,
  isHtmlTable,
  isZip,
  odsRows,
  spreadsheetKind,
  xlsxRows,
} from "./sheets";
import { readTable, type TableReading } from "./table";

/**
 * A bank's file, whatever it is, read as statement lines: the one entry
 * point both apps call. The kind of file is decided by what it holds — a
 * file called `export.xls` that is really a web page is read as the page,
 * and a CSV named `.txt` as a CSV — never by its name alone.
 *
 * What cannot be read here says so (`problem`): a PDF, an old binary Excel
 * or an image goes to the server; a table whose columns cannot be told apart
 * comes back as its rows, for the person to name them.
 */

/** Text out of bytes: UTF-16 by its mark or its zeros, else UTF-8, else Windows-1252. */
export function statementText(bytes: Uint8Array): string {
  const littleMark = bytes[0] === 0xff && bytes[1] === 0xfe;
  const bigMark = bytes[0] === 0xfe && bytes[1] === 0xff;
  // ASCII written as UTF-16 without a mark: every other byte a zero.
  let zerosAtOdd = 0;
  let zerosAtEven = 0;
  const probe = Math.min(bytes.length, 400);
  for (let index = 0; index < probe; index += 1) {
    if (bytes[index] === 0) {
      if (index % 2 === 1) zerosAtOdd += 1;
      else zerosAtEven += 1;
    }
  }
  const little =
    littleMark || (!bigMark && zerosAtOdd > probe * 0.3 && zerosAtEven === 0);
  const big =
    bigMark || (!littleMark && zerosAtEven > probe * 0.3 && zerosAtOdd === 0);
  if (little || big) {
    let text = "";
    for (
      let index = littleMark || bigMark ? 2 : 0;
      index + 1 < bytes.length;
      index += 2
    ) {
      const unit = little
        ? bytes[index]! | (bytes[index + 1]! << 8)
        : (bytes[index]! << 8) | bytes[index + 1]!;
      text += String.fromCharCode(unit);
    }
    return text;
  }
  return decodeStatement(bytes);
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

/** What the bytes are, by their first bytes and then their text. */
export function detectStatementFormat(bytes: Uint8Array): StatementFormat {
  if (bytes.length === 0) {
    return "unknown";
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return "xls";
  if (
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) ||
    startsWith(bytes, [0xff, 0xd8, 0xff]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) ||
    (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57) ||
    (bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70)
  ) {
    return "image";
  }
  if (isZip(bytes)) {
    return spreadsheetKind(bytes) ?? "unknown";
  }
  return detectTextFormat(statementText(bytes));
}

/** What a text is: the same tests, for a paste. */
export function detectTextFormat(text: string): StatementFormat {
  const trimmed = text.trim();
  if (trimmed === "") return "unknown";
  if (isOfx(trimmed)) return "ofx";
  if (isCamt(trimmed)) return "camt";
  if (isHtmlTable(trimmed)) return "html";
  if (isQif(trimmed)) return "qif";
  if (isMt940(trimmed)) return "mt940";
  if (isCfonb(text)) return "cfonb";
  return "csv";
}

function fromTable(format: StatementFormat, reading: TableReading): Statement {
  return {
    format,
    bank: reading.bank,
    blocks: reading.blocks,
    skipped: reading.skipped,
    problem: reading.problem,
    table: reading.table,
  };
}

function fromBlocks(
  format: StatementFormat,
  read: { bank?: BankId | null; blocks: StatementBlock[]; skipped: number },
): Statement {
  return {
    format,
    bank: read.bank ?? null,
    blocks: read.blocks,
    skipped: read.skipped,
    problem:
      read.blocks.length === 0
        ? read.skipped > 0
          ? "unreadable"
          : "empty"
        : null,
    table: null,
  };
}

/** A CSV's rows, under the delimiter that gives the most even table. */
function csvRows(text: string): string[][] {
  const candidates: CsvDelimiter[] = [detectDelimiter(text), ";", ",", "\t"];
  let best: { rows: string[][]; width: number; consistency: number } | null =
    null;
  for (const delimiter of new Set(candidates)) {
    const rows = parseCsv(text, delimiter).filter((row) =>
      row.some((cell) => cell.trim() !== ""),
    );
    if (rows.length === 0) continue;
    const widths = rows.map((row) => row.length);
    const common = mostCommon(widths);
    const consistency =
      widths.filter((width) => width === common).length / rows.length;
    if (
      common > 1 &&
      (best === null ||
        consistency * Math.min(common, 8) >
          best.consistency * Math.min(best.width, 8))
    ) {
      best = { rows, width: common, consistency };
    }
  }
  return best?.rows ?? parseCsv(text, detectDelimiter(text));
}

function mostCommon(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ??
    0
  );
}

/** Text — a file's, or what was pasted — read as a statement. */
export function readStatementText(
  text: string,
  format = detectTextFormat(text),
): Statement {
  if (text.trim() === "") {
    return emptyStatement("unknown", "empty");
  }
  switch (format) {
    case "ofx":
      return fromBlocks("ofx", readOfx(text));
    case "camt":
      return fromBlocks("camt", readCamt(text));
    case "qif":
      return fromBlocks("qif", readQif(text));
    case "mt940":
      return fromBlocks("mt940", readMt940(text));
    case "cfonb":
      return fromBlocks("cfonb", readCfonb(text));
    case "html": {
      const { rows, preamble } = htmlTable(text);
      return fromTable("html", readTable(rows, { preamble }));
    }
    case "csv":
      return fromTable("csv", readTable(csvRows(text)));
    default:
      return emptyStatement(format, "unreadable");
  }
}

function emptyStatement(
  format: StatementFormat,
  problem: Statement["problem"],
): Statement {
  return { format, bank: null, blocks: [], skipped: 0, problem, table: null };
}

/** A file's bytes read as a statement. */
export function readStatementFile(bytes: Uint8Array): Statement {
  const format = detectStatementFormat(bytes);
  switch (format) {
    case "pdf":
    case "xls":
    case "image":
      return emptyStatement(format, "notHere");
    case "unknown":
      return emptyStatement(
        format,
        bytes.length === 0 ? "empty" : "unreadable",
      );
    case "xlsx":
      return fromTable("xlsx", readTable(xlsxRows(bytes)));
    case "ods":
      return fromTable("ods", readTable(odsRows(bytes)));
    default:
      return readStatementText(statementText(bytes), format);
  }
}
