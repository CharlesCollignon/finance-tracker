/**
 * The Journal as a CSV file, in the reader's language and the shape their
 * spreadsheet expects.
 *
 * French Excel splits a line on semicolons and reads a comma as the decimal
 * mark, so a French reader gets both; anyone else gets commas and a point.
 * Either reads back through the app's own import, which detects the
 * delimiter and knows these headers.
 *
 * A text cell that starts with =, +, - or @ is a formula to Excel and
 * LibreOffice, and a bank's note or a category name can start that way: it
 * goes out behind an apostrophe, which keeps it text (OWASP's advice on CSV
 * injection). Amounts and dates are written by the app and are never text.
 */

import type { Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import type { TransactionWithCategory } from "./types/database";

const FORMULA_START = /^[=+\-@\t\r]/;

/** One text cell, defused and quoted as the delimiter needs. */
export function csvTextCell(value: string, delimiter: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r") ||
    safe.includes(delimiter)
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}

export function buildLedgerCsv(
  transactions: readonly TransactionWithCategory[],
  locale: Locale,
): string {
  const t = translator(locale);
  const delimiter = locale === "fr" ? ";" : ",";
  const amount = (value: number) =>
    locale === "fr" ? String(value).replace(".", ",") : String(value);
  const text = (value: string) => csvTextCell(value, delimiter);

  const header = [
    t("ledger.csv.date"),
    t("ledger.csv.category"),
    t("ledger.csv.type"),
    t("ledger.csv.amount"),
    t("ledger.csv.note"),
  ].map(text);
  const rows = transactions.map((tx) =>
    [
      tx.occurred_on,
      text(tx.categories.name),
      text(t(`categoryType.${tx.categories.type}`)),
      amount(Number(tx.amount)),
      text(tx.note ?? ""),
    ].join(delimiter),
  );

  // CRLF, as RFC 4180 and every spreadsheet expect.
  return [header.join(delimiter), ...rows].join("\r\n");
}
