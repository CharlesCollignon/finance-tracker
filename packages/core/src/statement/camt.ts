import { bankFromIban, type BankId } from "./banks";
import { withLineIds } from "./line-ids";
import {
  NO_ACCOUNT,
  type RawLine,
  type StatementBalance,
  type StatementBlock,
} from "./model";
import { makeLine } from "./table";
import { decimalOf, strictAmount } from "./values";
import {
  allText,
  child,
  findAll,
  parseXml,
  textAt,
  type XmlElement,
} from "./xml";

/**
 * CAMT.053 (the day's statement) and CAMT.052 (the account report), the
 * ISO 20022 XML that business accounts and Qonto hand out: each `Stmt` or
 * `Rpt` an account, each `Ntry` a line, balances typed `OPBD` (opening) and
 * `CLBD` (closing). Only booked entries are lines; a pending one is money
 * that has not moved yet.
 */

export function isCamt(text: string): boolean {
  const head = text.slice(0, 4000);
  return /camt\.05[234]|BkToCstmrStmt|BkToCstmrAcctRpt|BkToCstmrDbtCdtNtfctn/.test(
    head,
  );
}

function dateOf(element: XmlElement | null): string | null {
  const value = textAt(element, "Dt") || textAt(element, "DtTm");
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function signed(element: XmlElement | null): number | null {
  const amount = strictAmount(textAt(element, "Amt"));
  if (amount === null) {
    return null;
  }
  return textAt(element, "CdtDbtInd") === "DBIT"
    ? -Math.abs(amount)
    : Math.abs(amount);
}

function balance(
  statement: XmlElement,
  codes: string[],
): StatementBalance | null {
  for (const entry of statement.children.filter(
    (node) => node.name === "Bal",
  )) {
    const code =
      textAt(entry, "Tp", "CdOrPrtry", "Cd") ||
      textAt(entry, "Tp", "CdOrPrtry", "Prtry");
    if (codes.includes(code)) {
      const amount = signed(entry);
      if (amount !== null) {
        return { date: dateOf(child(entry, "Dt")), amount: decimalOf(amount) };
      }
    }
  }
  return null;
}

export function readCamt(text: string): {
  bank: BankId | null;
  blocks: StatementBlock[];
  skipped: number;
} {
  const root = parseXml(text);
  const statements = [
    ...findAll(root, "Stmt"),
    ...findAll(root, "Rpt"),
    ...findAll(root, "Ntfctn"),
  ];
  let bank: BankId | null = null;
  let skipped = 0;
  const blocks: StatementBlock[] = [];

  for (const statement of statements) {
    const account = child(statement, "Acct");
    const iban =
      textAt(account, "Id", "IBAN").replace(/\s+/g, "").toUpperCase() || null;
    const other = textAt(account, "Id", "Othr", "Id") || null;
    const currency = (textAt(account, "Ccy") || "EUR").toUpperCase();
    bank ??= bankFromIban(iban);

    const lines: RawLine[] = [];
    for (const entry of statement.children.filter(
      (node) => node.name === "Ntry",
    )) {
      const status = textAt(entry, "Sts", "Cd") || textAt(entry, "Sts");
      if (status && status !== "BOOK") {
        continue;
      }
      const amount = signed(entry);
      const date =
        dateOf(child(entry, "BookgDt")) ?? dateOf(child(entry, "ValDt"));
      if (amount === null || !date) {
        skipped += 1;
        continue;
      }
      const details = child(entry, "NtryDtls", "TxDtls");
      const out = amount < 0;
      const party = child(details, "RltdPties", out ? "Cdtr" : "Dbtr");
      const partyName = textAt(party, "Nm") || textAt(party, "Pty", "Nm");
      const partyIban =
        textAt(
          child(details, "RltdPties", out ? "CdtrAcct" : "DbtrAcct"),
          "Id",
          "IBAN",
        ) || null;
      const remittance = findAll(
        child(details, "RmtInf") ?? {
          name: "",
          attributes: {},
          children: [],
          text: "",
        },
        "Ustrd",
      )
        .map((node) => allText(node).trim())
        .filter(Boolean)
        .join(" ");
      const label = remittance || textAt(entry, "AddtlNtryInf") || partyName;
      const line = makeLine({
        date,
        valueDate: dateOf(child(entry, "ValDt")),
        amount,
        label: label || partyName,
        counterparty: partyName || null,
        counterpartyIban: partyIban,
        currency:
          child(entry, "Amt")?.attributes.Ccy?.toUpperCase() ?? currency,
      });
      if (line) {
        lines.push(line);
      }
    }

    const opening = balance(statement, ["OPBD", "PRCD"]);
    const closing = balance(statement, ["CLBD", "ITBD"]);
    const period = child(statement, "FrToDt");
    const days = lines.map((line) => line.bookingDate!).sort();
    blocks.push({
      account:
        iban || other
          ? { ...NO_ACCOUNT, iban, number: iban ? null : other }
          : null,
      currency,
      from:
        textAt(period, "FrDtTm").slice(0, 10) ||
        opening?.date ||
        days[0] ||
        null,
      to:
        textAt(period, "ToDtTm").slice(0, 10) ||
        closing?.date ||
        days[days.length - 1] ||
        null,
      opening,
      closing,
      lines: withLineIds(lines),
      signUnknown: false,
    });
  }
  return {
    bank,
    blocks: blocks.filter((block) => block.lines.length > 0 || block.closing),
    skipped,
  };
}
