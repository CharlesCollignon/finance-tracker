import { bankFromIban, type BankId } from "./banks";
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
 * MT940, the SWIFT statement Qonto and business accounts export: tagged
 * lines — `:25:` the account, `:60F:` the opening balance, `:61:` a line,
 * `:86:` what it was, `:62F:` the closing balance — one statement after
 * another, amounts with a decimal comma.
 */

export function isMt940(text: string): boolean {
  const head = text.slice(0, 5000);
  return /(^|\n):20:/.test(head) && /(^|\n):(25|61|60F|60M):/.test(head);
}

/** `261012` → `2026-10-12`. */
function shortDate(value: string): string | null {
  const match = /^(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]) < 70 ? `20${match[1]}` : `19${match[1]}`;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${match[2]}-${match[3]}`;
}

function amountOf(value: string): number {
  return Number(value.replace(",", "."));
}

/** `C261012EUR1234,56` → the balance it states. */
function balanceOf(value: string): StatementBalance | null {
  const match = /^([CD])(\d{6})([A-Z]{3})([\d,]+)/.exec(value.trim());
  if (!match) {
    return null;
  }
  const amount = amountOf(match[4]!);
  return {
    date: shortDate(match[2]!),
    amount: decimalOf(match[1] === "D" ? -amount : amount),
  };
}

/** The tagged fields in order, each with its continuation lines. */
function fields(text: string): { tag: string; value: string }[] {
  const found: { tag: string; value: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const tagged = /^:(\d{2}[A-Z]?):(.*)$/.exec(raw);
    if (tagged) {
      found.push({ tag: tagged[1]!, value: tagged[2]! });
    } else if (
      found.length > 0 &&
      raw.trim() &&
      !/^-\}?$|^\{/.test(raw.trim())
    ) {
      found[found.length - 1]!.value += `\n${raw}`;
    }
  }
  return found;
}

/** `:86:` as words: a structured one's `?20`…`?29` parts, or the text as it is. */
function informationOf(value: string): string {
  const flat = value.replace(/\n/g, "");
  if (/\?\d{2}/.test(flat)) {
    const parts = flat.split(/\?(\d{2})/);
    const words: string[] = [];
    for (let index = 1; index < parts.length; index += 2) {
      const code = Number(parts[index]);
      if (
        (code >= 20 && code <= 29) ||
        code === 32 ||
        code === 33 ||
        (code >= 60 && code <= 63)
      ) {
        words.push(parts[index + 1] ?? "");
      }
    }
    return words.join(" ").replace(/\s+/g, " ").trim();
  }
  return value.replace(/\s+/g, " ").trim();
}

const LINE = /^(\d{6})(\d{4})?(R?[CD])([A-Z])?([\d,]+)([NSF][A-Z0-9]{3})?(.*)$/;

export function readMt940(text: string): {
  bank: BankId | null;
  blocks: StatementBlock[];
  skipped: number;
} {
  let bank: BankId | null = null;
  let skipped = 0;
  const blocks: StatementBlock[] = [];
  let current: {
    account: string;
    opening: StatementBalance | null;
    closing: StatementBalance | null;
    lines: { line: RawLine; info: string }[];
  } | null = null;

  const close = () => {
    if (!current) {
      return;
    }
    const lines = current.lines.map(({ line, info }) => ({
      ...line,
      remittanceInformation: info || line.remittanceInformation,
    }));
    const days = lines.map((line) => line.bookingDate!).sort();
    const accountId = current.account.replace(/\s+/g, "");
    const iban = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(accountId)
      ? accountId
      : null;
    bank ??= bankFromIban(iban);
    blocks.push({
      account: accountId
        ? { ...NO_ACCOUNT, iban, number: iban ? null : accountId }
        : null,
      currency: "EUR",
      from: current.opening?.date ?? days[0] ?? null,
      to: current.closing?.date ?? days[days.length - 1] ?? null,
      opening: current.opening,
      closing: current.closing,
      lines: withLineIds(lines),
      signUnknown: false,
    });
    current = null;
  };

  for (const { tag, value } of fields(text)) {
    if (tag === "20") {
      close();
      current = { account: "", opening: null, closing: null, lines: [] };
    } else if (!current) {
      continue;
    } else if (tag === "25") {
      current.account = value.trim().split("/").pop() ?? value.trim();
    } else if (tag === "60F" || tag === "60M") {
      current.opening ??= balanceOf(value);
    } else if (tag === "62F" || tag === "62M") {
      current.closing = balanceOf(value);
    } else if (tag === "61") {
      const match = LINE.exec(value.replace(/\n/g, " "));
      const date = match ? shortDate(match[1]!) : null;
      if (!match || !date) {
        skipped += 1;
        continue;
      }
      const amount = amountOf(match[5]!);
      const credit = match[3] === "C" || match[3] === "RD";
      const line = makeLine({
        date,
        amount: credit ? amount : -amount,
        label: (match[7] ?? "").replace(/\/\/.*$/, "").trim(),
        currency: "EUR",
      });
      if (line) {
        current.lines.push({ line, info: "" });
      }
    } else if (tag === "86" && current.lines.length > 0) {
      current.lines[current.lines.length - 1]!.info = informationOf(value);
    }
  }
  close();
  return {
    bank,
    blocks: blocks.filter((block) => block.lines.length > 0 || block.closing),
    skipped,
  };
}
