import { bankFromCode, bankFromText, type BankId } from "./banks";
import { withLineIds } from "./line-ids";
import { NO_ACCOUNT, type RawLine, type StatementBlock } from "./model";
import { makeLine } from "./table";
import { decimalOf, strictAmount } from "./values";

/**
 * OFX and QFX — « Money », « Quicken » in a bank's export menu — in the old
 * SGML form, where tags are not closed, or as XML. One file may hold several
 * accounts (a current account and a card, a checking and a savings), each a
 * `STMTRS` or `CCSTMTRS` of its own: each becomes a block.
 *
 * French banks write the amount with a comma now and then (`-12,50`), and
 * split a long label between `NAME` (32 characters) and `MEMO`; both are
 * read as they are.
 */

export function isOfx(text: string): boolean {
  const head = text.slice(0, 3000).toUpperCase();
  return head.includes("OFXHEADER") || /<OFX[\s>]/.test(head);
}

/** One field: `<TAG>value`, closed or not. */
function field(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, "i").exec(block);
  return match ? match[1]!.trim() : "";
}

/** The part of `text` inside `<tag>…</tag>`, or after `<tag>` to the end. */
function section(text: string, tag: string): string {
  const open = new RegExp(`<${tag}>`, "i").exec(text);
  if (!open) {
    return "";
  }
  const rest = text.slice(open.index + open[0].length);
  const close = new RegExp(`</${tag}>`, "i").exec(rest);
  return close ? rest.slice(0, close.index) : rest;
}

/** `20261008`, `20261008120000.000[+1:CET]` → `2026-10-08`. */
function ofxDate(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function ofxAmount(value: string): number | null {
  return value ? strictAmount(value) : null;
}

/** Each statement in the file, with what it says around its lines. */
function statements(text: string): string[] {
  const found: string[] = [];
  const pattern = /<(CC)?STMTRS>/gi;
  let match: RegExpExecArray | null;
  const starts: number[] = [];
  while ((match = pattern.exec(text))) {
    starts.push(match.index);
  }
  for (let index = 0; index < starts.length; index += 1) {
    found.push(text.slice(starts[index], starts[index + 1] ?? text.length));
  }
  return found;
}

export function readOfx(text: string): {
  bank: BankId | null;
  blocks: StatementBlock[];
  skipped: number;
} {
  let bank: BankId | null =
    bankFromText(field(section(text, "FI"), "ORG")) ?? null;
  let skipped = 0;
  const blocks: StatementBlock[] = [];

  for (const statement of statements(text)) {
    const from =
      section(statement, "BANKACCTFROM") || section(statement, "CCACCTFROM");
    const bankId = field(from, "BANKID");
    const branch = field(from, "BRANCHID");
    const accountId = field(from, "ACCTID");
    bank ??= bankFromCode(bankId);
    const currency = (field(statement, "CURDEF") || "EUR").toUpperCase();

    const raw: RawLine[] = [];
    const blocksOfLines = statement.split(/<STMTTRN>/i).slice(1);
    for (const part of blocksOfLines) {
      const transaction = part.split(/<\/STMTTRN>/i)[0] ?? part;
      const date =
        ofxDate(field(transaction, "DTPOSTED")) ??
        ofxDate(field(transaction, "DTUSER"));
      const amount = ofxAmount(field(transaction, "TRNAMT"));
      if (!date || amount === null) {
        skipped += 1;
        continue;
      }
      const name =
        field(transaction, "NAME") ||
        field(section(transaction, "PAYEE"), "NAME");
      const memo = field(transaction, "MEMO");
      const label =
        memo && !name.toLowerCase().includes(memo.toLowerCase())
          ? [name, memo].filter(Boolean).join(" ")
          : name || memo;
      const line = makeLine({
        date,
        valueDate: ofxDate(field(transaction, "DTAVAIL")),
        transactionDate: ofxDate(field(transaction, "DTUSER")),
        amount,
        label,
        currency: (field(transaction, "CURRENCY") || currency)
          .toUpperCase()
          .slice(0, 3),
      });
      if (line) {
        raw.push(line);
      }
    }

    const ledger = section(statement, "LEDGERBAL");
    const closingAmount = ofxAmount(field(ledger, "BALAMT"));
    const list = section(statement, "BANKTRANLIST");
    const days = raw.map((line) => line.bookingDate!).sort();

    blocks.push({
      account: accountId
        ? {
            ...NO_ACCOUNT,
            number: [bankId, branch, accountId].filter(Boolean).join(""),
          }
        : null,
      currency,
      from: ofxDate(field(list, "DTSTART")) ?? days[0] ?? null,
      to: ofxDate(field(list, "DTEND")) ?? days[days.length - 1] ?? null,
      opening: null,
      closing:
        closingAmount === null
          ? null
          : {
              date: ofxDate(field(ledger, "DTASOF")),
              amount: decimalOf(closingAmount),
            },
      lines: withLineIds(raw),
      // An OFX's amounts are signed: TRNAMT is negative for money out.
      signUnknown: false,
    });
  }
  return {
    bank,
    blocks: blocks.filter((block) => block.lines.length > 0 || block.closing),
    skipped,
  };
}
