import { bankFromCode, type BankId } from "./banks";
import { withLineIds } from "./line-ids";
import {
  NO_ACCOUNT,
  type RawLine,
  type StatementBalance,
  type StatementBlock,
} from "./model";
import { makeLine } from "./table";
import { decimalOf } from "./values";

/**
 * CFONB 120, the French banks' own statement for businesses and their
 * accountants: records of exactly 120 characters, `01` the old balance, `04`
 * a line, `05` more words for the line before, `07` the new balance. The
 * amount's last character carries its sign (`{`, `A`–`I` for plus; `}`,
 * `J`–`R` for minus), and the number of decimals sits in column 20.
 * Written with or without line breaks between records.
 */

export function isCfonb(text: string): boolean {
  const records = recordsOf(text);
  return (
    records.length > 0 &&
    records.every((record) => record.length === 120 && /^0[1457]/.test(record))
  );
}

function recordsOf(text: string): string[] {
  const trimmed = text.replace(/\r/g, "").replace(/\n+$/, "");
  if (trimmed.includes("\n")) {
    return trimmed.split("\n").filter((line) => line.trim() !== "");
  }
  if (trimmed.length > 0 && trimmed.length % 120 === 0) {
    const records: string[] = [];
    for (let at = 0; at < trimmed.length; at += 120) {
      records.push(trimmed.slice(at, at + 120));
    }
    return records;
  }
  return [];
}

const POSITIVE = "{ABCDEFGHI";
const NEGATIVE = "}JKLMNOPQR";

/** Columns 91–104: digits, the last one signed by its letter. */
function amountOf(record: string): number | null {
  const raw = record.slice(90, 104);
  const decimals = Number(record[19]);
  const last = raw[raw.length - 1]!;
  let sign = 1;
  let digit: number;
  if (POSITIVE.includes(last)) {
    digit = POSITIVE.indexOf(last);
  } else if (NEGATIVE.includes(last)) {
    digit = NEGATIVE.indexOf(last);
    sign = -1;
  } else if (/\d/.test(last)) {
    digit = Number(last);
  } else {
    return null;
  }
  const digits = `${raw.slice(0, -1)}${digit}`;
  if (!/^\d+$/.test(digits) || !Number.isInteger(decimals)) {
    return null;
  }
  return (sign * Number(digits)) / 10 ** decimals;
}

/** `JJMMAA` → `20AA-MM-JJ`. */
function dateOf(value: string): string | null {
  const match = /^(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[3]) < 70 ? `20${match[3]}` : `19${match[3]}`;
  return Number(match[2]) >= 1 && Number(match[2]) <= 12
    ? `${year}-${match[2]}-${match[1]}`
    : null;
}

export function readCfonb(text: string): {
  bank: BankId | null;
  blocks: StatementBlock[];
  skipped: number;
} {
  let bank: BankId | null = null;
  let skipped = 0;
  const accounts = new Map<
    string,
    {
      number: string;
      currency: string;
      opening: StatementBalance | null;
      closing: StatementBalance | null;
      lines: RawLine[];
    }
  >();

  for (const record of recordsOf(text)) {
    const code = record.slice(0, 2);
    const bankCode = record.slice(2, 7);
    const branch = record.slice(11, 16);
    const currency = record.slice(16, 19).trim() || "EUR";
    const number = record.slice(21, 32).trim();
    const key = `${bankCode}${branch}${number}`;
    bank ??= bankFromCode(bankCode);
    const account = accounts.get(key) ?? {
      number: key,
      currency,
      opening: null,
      closing: null,
      lines: [],
    };
    accounts.set(key, account);

    if (code === "01" || code === "07") {
      const amount = amountOf(record);
      if (amount !== null) {
        const balance = {
          date: dateOf(record.slice(34, 40)),
          amount: decimalOf(amount),
        };
        if (code === "01") {
          account.opening ??= balance;
        } else {
          account.closing = balance;
        }
      }
    } else if (code === "04") {
      const amount = amountOf(record);
      const date = dateOf(record.slice(34, 40));
      if (amount === null || !date) {
        skipped += 1;
        continue;
      }
      const line = makeLine({
        date,
        valueDate: dateOf(record.slice(42, 48)),
        amount,
        label: record.slice(48, 79).trim(),
        currency,
      });
      if (line) {
        account.lines.push(line);
      }
    } else if (code === "05" && account.lines.length > 0) {
      const last = account.lines[account.lines.length - 1]!;
      const more = record.slice(48, 118).trim();
      if (more && !(last.remittanceInformation ?? "").includes(more)) {
        last.remittanceInformation =
          `${last.remittanceInformation ?? ""} ${more}`.trim();
      }
    }
  }

  const blocks: StatementBlock[] = [...accounts.values()].map((account) => {
    const days = account.lines.map((line) => line.bookingDate!).sort();
    return {
      account: { ...NO_ACCOUNT, number: account.number },
      currency: account.currency,
      from: account.opening?.date ?? days[0] ?? null,
      to: account.closing?.date ?? days[days.length - 1] ?? null,
      opening: account.opening,
      closing: account.closing,
      lines: withLineIds(account.lines),
      signUnknown: false,
    };
  });
  return {
    bank,
    blocks: blocks.filter((block) => block.lines.length > 0 || block.closing),
    skipped,
  };
}
