import { bankFromIban, bankFromText } from "./banks";
import { checkBlock } from "./check";
import { withLineIds } from "./line-ids";
import {
  NO_ACCOUNT,
  type RawLine,
  type Statement,
  type StatementAccount,
  type StatementBalance,
} from "./model";
import { makeLine } from "./table";
import { strictDate } from "./values";

/**
 * A statement no text can be taken from — a scanned PDF, a photo of a paper
 * statement, a screenshot of the bank's app — as the person's own AI
 * account read it (`apps/web/lib/statements/scan.ts`), with their consent
 * each time. What it answered is not taken on trust: every line is checked
 * here as a file's would be, the balances hold the lines to account where
 * the statement prints them, and every line read this way waits in « À
 * vérifier » (`readByAi`).
 */

/**
 * The answer's shape, as the model is asked for it (`response_format`).
 * Each line is one string — `date|label|amount|balance` — rather than an
 * object: a third of the words to write, and a statement read in the time
 * a request is given.
 */
export const SCAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "statement",
    "bank",
    "iban",
    "accountNumber",
    "currency",
    "periodFrom",
    "periodTo",
    "openingBalance",
    "closingBalance",
    "lines",
  ],
  properties: {
    statement: {
      type: "boolean",
      description:
        "True when the document is a bank statement or a list of bank account operations.",
    },
    bank: { type: ["string", "null"], description: "The bank's name as printed." },
    iban: { type: ["string", "null"] },
    accountNumber: { type: ["string", "null"] },
    currency: { type: "string", description: "ISO 4217, EUR when not printed." },
    periodFrom: { type: ["string", "null"], description: "YYYY-MM-DD" },
    periodTo: { type: ["string", "null"], description: "YYYY-MM-DD" },
    openingBalance: {
      type: ["string", "null"],
      description: "Signed, a point before the cents: -50.00",
    },
    closingBalance: { type: ["string", "null"] },
    lines: {
      type: "array",
      items: {
        type: "string",
        description:
          "YYYY-MM-DD|label as printed|signed amount, negative for money out|balance after, or empty",
      },
    },
  },
} as const;

/** The most lines one reading may bring. */
const MAX_LINES = 2000;

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : null;
}

/** « -1234.56 », « 1 234,56 », « +12.3 »: a signed amount, or null. */
function amountOf(value: unknown): number | null {
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  const clean = raw.replace(/[\s  €]/g, "").replace(/^\+/, "");
  const normalized = /,\d{1,2}$/.test(clean)
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean.replace(/,/g, "");
  if (!/^-?\d{1,10}(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Number(normalized);
}

function balanceOf(value: unknown, date: string | null): StatementBalance | null {
  const amount = amountOf(value);
  return amount === null ? null : { date, amount: amount.toFixed(2) };
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** What the AI answered, checked and read as a statement. */
export function statementFromScan(
  answer: unknown,
  { format, today }: { format: "pdf" | "image"; today: string },
): Statement {
  const empty = (problem: Statement["problem"]): Statement => ({
    format,
    bank: null,
    blocks: [],
    skipped: 0,
    problem,
    table: null,
    readByAi: true,
  });
  if (typeof answer !== "object" || answer === null) {
    return empty("unreadable");
  }
  const read = answer as Record<string, unknown>;
  if (read.statement === false || !Array.isArray(read.lines)) {
    return empty("unreadable");
  }

  const currency =
    typeof read.currency === "string" && /^[A-Z]{3}$/.test(read.currency)
      ? read.currency
      : "EUR";
  // No line from before banks kept them online, nor from next week.
  const earliest = addDays(today, -6 * 366);
  const latest = addDays(today, 7);

  const lines: RawLine[] = [];
  let skipped = 0;
  for (const entry of read.lines.slice(0, MAX_LINES)) {
    const parts = typeof entry === "string" ? entry.split("|") : [];
    // A label may hold a bar of its own: the date first, the figures last.
    const date = parts.length >= 3 ? strictDate(parts[0]!.trim()) : null;
    const hasBalance = parts.length >= 4;
    const amount = amountOf(parts[hasBalance ? parts.length - 2 : parts.length - 1]);
    const balance = hasBalance ? amountOf(parts[parts.length - 1]) : null;
    const label = parts
      .slice(1, hasBalance ? -2 : -1)
      .join("|")
      .trim();
    const line =
      date && date >= earliest && date <= latest && amount !== null
        ? makeLine({
            date,
            amount,
            label: label.slice(0, 300),
            currency,
            balanceAfter: balance,
          })
        : null;
    if (line) {
      lines.push(line);
    } else {
      skipped += 1;
    }
  }
  if (lines.length === 0) {
    return { ...empty("unreadable"), skipped };
  }

  const ibanText = text(read.iban, 40)?.replace(/\s/g, "").toUpperCase() ?? null;
  const iban = ibanText && /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(ibanText) ? ibanText : null;
  const number = text(read.accountNumber, 30)?.replace(/[\s.-]/g, "") ?? null;
  const account: StatementAccount | null =
    iban || (number && /^\d[\dA-Z]{4,}$/.test(number))
      ? { ...NO_ACCOUNT, iban, number: iban ? null : number }
      : null;

  const withIds = withLineIds(lines);
  const days = withIds
    .map((line) => line.bookingDate)
    .filter((day): day is string => day !== null)
    .sort();
  const periodFrom = strictDate(text(read.periodFrom, 10) ?? "");
  const periodTo = strictDate(text(read.periodTo, 10) ?? "");
  const period =
    periodFrom && periodTo && periodFrom <= periodTo ? { from: periodFrom, to: periodTo } : null;

  const opening = balanceOf(read.openingBalance, period ? addDays(period.from, -1) : null);
  const closing = balanceOf(read.closingBalance, period?.to ?? null);
  const draft = {
    account,
    currency,
    from: period?.from ?? days[0] ?? null,
    to: period?.to ?? days[days.length - 1] ?? null,
    opening,
    closing,
    lines: withIds,
    signUnknown: false,
  };
  const check = checkBlock(draft);

  return {
    format,
    bank: bankFromText(text(read.bank, 80) ?? "") ?? bankFromIban(iban),
    blocks: [
      {
        ...draft,
        // A balance the lines do not join is not one to keep.
        opening: check?.ok ? opening : null,
        closing: check?.ok ? closing : null,
        check,
      },
    ],
    skipped,
    problem: null,
    table: null,
    readByAi: true,
  };
}
