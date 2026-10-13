import { withLineIds } from "./line-ids";
import type { StatementBlock } from "./model";
import { makeLine } from "./table";
import { dateOrderOf, strictAmount, strictDate } from "./values";

/**
 * QIF — « Money » in many French banks' menus: one field per line, a letter
 * before each (`D` date, `T` amount, `P` payee, `M` memo), `^` between
 * records. Dates are written as the bank writes them — day first in France,
 * month first from Quicken (`1/15'26`) — and the order is decided over the
 * whole file, never line by line.
 */

export function isQif(text: string): boolean {
  return /^\s*!(Type|Account|Option)/im.test(text.slice(0, 500));
}

interface QifRecord {
  date: string;
  amount: string;
  payee: string;
  memo: string;
}

function records(text: string): QifRecord[] {
  const found: QifRecord[] = [];
  let current: QifRecord = { date: "", amount: "", payee: "", memo: "" };
  let inAccountList = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith("!")) {
      // `!Account` opens a list of accounts, not of transactions.
      inAccountList = /^!Account/i.test(line);
      continue;
    }
    if (line === "^") {
      if (!inAccountList && (current.date || current.amount)) {
        found.push(current);
      }
      current = { date: "", amount: "", payee: "", memo: "" };
      continue;
    }
    const code = line[0];
    const value = line.slice(1).trim();
    if (code === "D") current.date = value;
    else if (code === "T" || (code === "U" && !current.amount))
      current.amount = value;
    else if (code === "P") current.payee = value;
    else if (code === "M") current.memo = value;
  }
  return found;
}

/** `1/15'26` → `1/15/26`: Quicken's apostrophe before a short year. */
function plainDate(value: string): string {
  return value.replace(/'\s*/, "/").replace(/\s+/g, "");
}

export function readQif(text: string): {
  blocks: StatementBlock[];
  skipped: number;
} {
  const found = records(text);
  const order = dateOrderOf(found.map((record) => plainDate(record.date)));
  const lines = [];
  let skipped = 0;
  for (const record of found) {
    const date = strictDate(plainDate(record.date), order);
    const amount = strictAmount(record.amount);
    if (!date || amount === null) {
      skipped += 1;
      continue;
    }
    const label =
      record.memo &&
      !record.payee.toLowerCase().includes(record.memo.toLowerCase())
        ? `${record.payee} ${record.memo}`.trim()
        : record.payee || record.memo;
    const line = makeLine({ date, amount, label, currency: "EUR" });
    if (line) {
      lines.push(line);
    }
  }
  if (lines.length === 0) {
    return { blocks: [], skipped };
  }
  const days = lines.map((line) => line.bookingDate!).sort();
  return {
    blocks: [
      {
        account: null,
        currency: "EUR",
        from: days[0] ?? null,
        to: days[days.length - 1] ?? null,
        opening: null,
        closing: null,
        lines: withLineIds(lines),
        signUnknown: false,
      },
    ],
    skipped,
  };
}
