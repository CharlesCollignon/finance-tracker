import type { BankTransaction } from "../bank-feed";
import { bankFromIban, bankFromText } from "./banks";
import {
  checkBlock,
  checkTotals,
  joiningBalances,
  type StatementCheck,
  type StatementTotals,
} from "./check";
import { withLineIds } from "./line-ids";
import {
  NO_ACCOUNT,
  type RawLine,
  type Statement,
  type StatementAccount,
  type StatementBalance,
  type StatementBlock,
} from "./model";
import { ACCOUNT_NUMBER_IN_TEXT, IBAN_IN_TEXT, makeLine } from "./table";
import { decimalOf, monthNumber, strictAmount, strictDate } from "./values";

/**
 * A PDF statement, read from where its words sit on the page — the only
 * thing many banks' apps hand out, and the one every bank sends each month.
 *
 * The PDF itself is opened on the server (`apps/web/lib/statements/pdf.ts`),
 * which gives each run of text with its place; this is pure: places in,
 * lines out. Words at one height make a row; the row that names the
 * columns — « Date », « Libellé », « Débit », « Crédit » in any of the ways
 * French banks write them — says which column is which, and an amount is
 * money out or money in by the column it sits under, as the eye reads it.
 * A label that runs onto the next rows is joined back; a day written
 * without its year takes the statement's own period's.
 *
 * Every bank lays its statement out its own way, so nothing here is one
 * bank's: what holds the reading to account is the statement itself. Its
 * opening and closing balances, or its totals, must be met by the lines to
 * the cent (`check`), and the import says when they are not.
 */

/** One run of text on a page, where the PDF puts it: points, from the top left. */
export interface PdfText {
  x: number;
  /** Its baseline, from the top of the page. */
  y: number;
  width: number;
  /** The font's size, which is a row's height near enough. */
  height: number;
  text: string;
}

export interface PdfPage {
  texts: PdfText[];
}

interface Cell {
  x0: number;
  x1: number;
  text: string;
}

interface Row {
  page: number;
  y: number;
  height: number;
  cells: Cell[];
  text: string;
}

type ColumnKind =
  | "date"
  | "valueDate"
  | "label"
  | "debit"
  | "credit"
  | "amount"
  | "balance";

interface Column {
  kind: ColumnKind;
  x0: number;
  x1: number;
}

const AMOUNT_KINDS = new Set<ColumnKind>(["debit", "credit", "amount", "balance"]);

/* ------------------------------------------------------------------ rows */

function rowOf(page: number, texts: readonly PdfText[]): Row {
  const sorted = [...texts].sort((a, b) => a.x - b.x);
  const height = Math.max(...sorted.map((text) => text.height), 1);
  const cells: Cell[] = [];
  for (const text of sorted) {
    const last = cells[cells.length - 1];
    const size = Math.max(text.height, 1);
    const gap = last ? text.x - last.x1 : Infinity;
    // Words a space apart are one cell; columns are further apart than that.
    if (last && gap <= size * 0.6) {
      last.text += gap > size * 0.12 ? ` ${text.text}` : text.text;
      last.x1 = Math.max(last.x1, text.x + text.width);
    } else {
      cells.push({ x0: text.x, x1: text.x + text.width, text: text.text });
    }
  }
  const clean = cells
    .map((cell) => ({ ...cell, text: cell.text.replace(/\s+/g, " ").trim() }))
    .filter((cell) => cell.text !== "");
  return {
    page,
    y: sorted.reduce((sum, text) => sum + text.y, 0) / sorted.length,
    height,
    cells: clean,
    text: clean.map((cell) => cell.text).join(" "),
  };
}

/** The pages' words as rows, top to bottom, page after page. */
function rowsOf(pages: readonly PdfPage[]): Row[] {
  const rows: Row[] = [];
  pages.forEach((page, index) => {
    const texts = page.texts
      .filter(
        (text) =>
          text.text.trim() !== "" &&
          Number.isFinite(text.x) &&
          Number.isFinite(text.y),
      )
      .sort((a, b) => a.y - b.y || a.x - b.x);
    let group: PdfText[] = [];
    let groupY = 0;
    for (const text of texts) {
      const tolerance = Math.max(1.5, 0.35 * Math.max(text.height, 1));
      if (group.length > 0 && Math.abs(text.y - groupY) > tolerance) {
        rows.push(rowOf(index, group));
        group = [];
      }
      if (group.length === 0) {
        groupY = text.y;
      }
      group.push(text);
    }
    if (group.length > 0) {
      rows.push(rowOf(index, group));
    }
  });
  return rows.filter((row) => row.cells.length > 0);
}

/* --------------------------------------------------------------- columns */

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The column a header cell names, as French banks (and a few others) word it. */
function columnKind(text: string): ColumnKind | null {
  const words = plain(text);
  if (words === "" || words.length > 32) {
    return null;
  }
  if (/\bvaleur\b|\bvalue date\b|\bdate val\b/.test(words)) {
    return "valueDate";
  }
  if (/^(date|jour)\b/.test(words)) {
    return "date";
  }
  if (
    /\b(debits?|sorties?|retraits?|money out|paid out|argent sortant|withdrawals?)\b/.test(
      words,
    )
  ) {
    return "debit";
  }
  if (
    /\b(credits?|entrees?|versements?|money in|paid in|argent entrant|deposits?)\b/.test(
      words,
    )
  ) {
    return "credit";
  }
  if (/\b(solde|balance)\b/.test(words)) {
    return "balance";
  }
  if (/\b(montant|amount|somme)\b/.test(words)) {
    return "amount";
  }
  if (
    /\b(libelle|operations?|nature|designation|detail|details|description|intitule|transactions?|motif)\b/.test(
      words,
    )
  ) {
    return "label";
  }
  return null;
}

/** The columns a row names, when it is the table's header. */
function headerOf(cells: readonly Cell[]): Column[] | null {
  if (cells.some((cell) => amountIn(cell.text) !== null)) {
    return null;
  }
  const columns: Column[] = [];
  for (const cell of cells) {
    let kind = columnKind(cell.text);
    if (kind === "date" && columns.some((column) => column.kind === "date")) {
      kind = "valueDate";
    }
    if (kind) {
      columns.push({ kind, x0: cell.x0, x1: cell.x1 });
    }
  }
  const has = (kind: ColumnKind) => columns.some((column) => column.kind === kind);
  const money = (has("debit") && has("credit")) || has("amount");
  return has("date") && money && columns.length >= 3 ? columns : null;
}

/** Two rows read as one: a header written over two lines (« Date » / « opé. »). */
function stacked(top: Row, bottom: Row): Cell[] {
  const cells = top.cells.map((cell) => ({ ...cell }));
  for (const cell of bottom.cells) {
    const above = cells.find(
      (other) => Math.max(other.x0, cell.x0) < Math.min(other.x1, cell.x1) + 2,
    );
    if (above) {
      above.text = `${above.text} ${cell.text}`;
      above.x0 = Math.min(above.x0, cell.x0);
      above.x1 = Math.max(above.x1, cell.x1);
    } else {
      cells.push({ ...cell });
    }
  }
  return cells.sort((a, b) => a.x0 - b.x0);
}

/* ----------------------------------------------------------------- values */

/** An amount with its cents, and nothing else: « 1 234,56 », « -12.30 € ». */
function amountIn(text: string): number | null {
  if (!/\d[.,]\d{2}(?!\d)/.test(text)) {
    return null;
  }
  return strictAmount(text.replace(/\b(?:eur|euros?)\b/gi, "").trim());
}

/** Whether an amount says which way it went: a minus, or a plus. */
function signed(text: string): boolean {
  return /^\s*[+-]|[+-]\s*$/.test(text.replace(/\s*(?:€|eur|euros?)\s*$/i, ""));
}

interface DayMonth {
  day: number;
  month: number;
  year: number | null;
  /** How much of the text the date took. */
  length: number;
}

const NUMERIC_START =
  /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?(?![\d/.-])/;
const NAMED_START = /^(\d{1,2})(?:er)?\s+([a-zA-Zéèêûôàç]{3,10})\.?(?:\s+(\d{4}))?(?=\s|$)/;
const NAMED_START_US = /^([a-zA-Z]{3,10})\.?\s+(\d{1,2}),?(?:\s+(\d{4}))?(?=\s|$)/;

function fullYear(text: string | undefined): number | null {
  if (!text) return null;
  const year = Number(text);
  return text.length === 2 ? 2000 + year : year;
}

/** A date at the start of `text`, with or without its year. */
function dateAtStart(text: string): DayMonth | null {
  const numeric = NUMERIC_START.exec(text);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day, month, year: fullYear(numeric[3]), length: numeric[0].length };
    }
    return null;
  }
  const named = NAMED_START.exec(text);
  if (named) {
    const month = monthNumber(named[2]!);
    if (month) {
      return {
        day: Number(named[1]),
        month,
        year: fullYear(named[3]),
        length: named[0].length,
      };
    }
  }
  const us = NAMED_START_US.exec(text);
  if (us) {
    const month = monthNumber(us[1]!);
    if (month) {
      return {
        day: Number(us[2]),
        month,
        year: fullYear(us[3]),
        length: us[0].length,
      };
    }
  }
  return null;
}

function isoOf(year: number, month: number, day: number): string | null {
  return strictDate(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );
}

/**
 * A day written without its year, given one: the year that puts it in or
 * just before the statement's period — a December line on a January
 * statement is last year's.
 */
function dateIn(date: DayMonth, anchor: { year: number; month: number }): string | null {
  if (date.year !== null) {
    return isoOf(date.year, date.month, date.day);
  }
  const year = date.month > anchor.month + 1 ? anchor.year - 1 : anchor.year;
  return isoOf(year, date.month, date.day);
}

const DATE_TOKEN =
  "(\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?|\\d{1,2}(?:er)?\\s+[a-zA-Zéèêûôàç]{3,10}\\.?(?:\\s+\\d{4})?)";
const PERIOD = new RegExp(
  `\\b(?:du|from|period(?:e)?\\s+du)\\s+${DATE_TOKEN}\\s+(?:au|to|jusqu'au)\\s+${DATE_TOKEN}`,
  "i",
);
const FULL_DATE = /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\b/g;

/** The period a statement states: « du 1er septembre 2026 au 30 septembre 2026 ». */
function periodOf(text: string): { from: string; to: string } | null {
  const match = PERIOD.exec(text);
  if (!match) return null;
  const last = dateAtStart(match[2]!);
  const first = dateAtStart(match[1]!);
  if (!last || last.year === null || !first) return null;
  const to = isoOf(last.year, last.month, last.day);
  const from = dateIn(first, { year: last.year, month: last.month });
  return to && from && from <= to ? { from, to } : null;
}

/* ---------------------------------------------------------------- reading */

interface Amount {
  kind: ColumnKind;
  value: number;
  signed: boolean;
}

/** The amount-kind column an amount sits under, or null when it sits under none. */
function amountColumn(cell: Cell, columns: readonly Column[]): ColumnKind | null {
  let best: { kind: ColumnKind; score: number } | null = null;
  for (const column of columns) {
    if (!AMOUNT_KINDS.has(column.kind)) continue;
    const score = Math.min(
      Math.abs(cell.x1 - column.x1),
      Math.abs((cell.x0 + cell.x1) / 2 - (column.x0 + column.x1) / 2),
    );
    if (!best || score < best.score) {
      best = { kind: column.kind, score };
    }
  }
  return best && best.score <= 60 ? best.kind : null;
}

/**
 * A row's amounts, by the column each sits under, and the cells left: an
 * amount run into the end of a label (a long label, a narrow gap) is
 * parted from it by where it would sit.
 */
function amountsOf(
  row: Row,
  columns: readonly Column[] | null,
): { amounts: Amount[]; rest: Cell[] } {
  const amounts: Amount[] = [];
  const rest: Cell[] = [];
  row.cells.forEach((cell, index) => {
    const whole = amountIn(cell.text);
    if (whole !== null) {
      const kind = columns
        ? amountColumn(cell, columns)
        : index > 0
          ? "amount"
          : null;
      if (kind) {
        amounts.push({ kind, value: whole, signed: signed(cell.text) });
        return;
      }
    }
    const tail = /\s([+-]?\d[\d  .,]*[.,]\d{2}\s?-?)$/.exec(cell.text);
    if (columns && tail && whole === null) {
      const value = amountIn(tail[1]!);
      const share = (cell.text.length - tail[1]!.length) / cell.text.length;
      const part: Cell = {
        x0: cell.x0 + (cell.x1 - cell.x0) * share,
        x1: cell.x1,
        text: tail[1]!,
      };
      const kind = value === null ? null : amountColumn(part, columns);
      if (value !== null && kind) {
        amounts.push({ kind, value, signed: signed(tail[1]!) });
        rest.push({ ...cell, x1: part.x0, text: cell.text.slice(0, tail.index).trim() });
        return;
      }
    }
    rest.push(cell);
  });
  return { amounts, rest };
}

/**
 * What a row is when it is no line: a balance, the totals, a figure carried
 * to the next page. By its first words only — « VIR SEPA SOLDE DE TOUT
 * COMPTE » is a last salary, not a balance.
 */
function rowRole(text: string): "balance" | "total" | "carried" | null {
  const words = plain(text).replace(/^\d{1,2} \d{1,2}( \d{2,4})? /, "");
  if (/^((sous )?total )?(a reporter|report|reporte)\b|^sous total\b/.test(words)) {
    return "carried";
  }
  if (
    /^((ancien|nouveau|votre|le|son)\s+)?solde\b/.test(words) ||
    /^((opening|closing|starting|ending|new|previous)\s+)?balance\b/.test(words)
  ) {
    return "balance";
  }
  if (/^(total|totaux)\b/.test(words)) return "total";
  return null;
}

function balanceOf(
  row: Row,
  amounts: readonly Amount[],
  anchor: { year: number; month: number } | null,
): StatementBalance | null {
  const chosen =
    amounts.find((amount) => amount.kind === "credit") ??
    amounts.find((amount) => amount.kind === "debit") ??
    amounts[amounts.length - 1];
  if (!chosen) return null;
  let value = chosen.value;
  if (
    value > 0 &&
    (chosen.kind === "debit" || /\bdebiteur\b|\bdebit\b/.test(plain(row.text)))
  ) {
    value = -value;
  }
  const dated = [...row.text.matchAll(FULL_DATE)][0]?.[1];
  const date = dated
    ? strictDate(dated)
    : (() => {
        const short = /\b(\d{1,2})[/.](\d{1,2})\b/.exec(row.text);
        const found = short ? dateAtStart(short[0]) : null;
        return found && anchor ? dateIn(found, anchor) : null;
      })();
  return { date, amount: decimalOf(value) };
}

function accountIn(text: string): StatementAccount | null {
  const iban = IBAN_IN_TEXT.exec(text.toUpperCase());
  if (iban && iban[1]!.replace(/\s/g, "").length >= 15) {
    return { ...NO_ACCOUNT, iban: iban[1]!.replace(/\s/g, "") };
  }
  const number = ACCOUNT_NUMBER_IN_TEXT.exec(text);
  return number ? { ...NO_ACCOUNT, number: number[1]!.replace(/\s/g, "") } : null;
}

function sameAccount(a: StatementAccount | null, b: StatementAccount | null): boolean {
  return (a?.iban ?? a?.number ?? null) === (b?.iban ?? b?.number ?? null);
}

interface Pending {
  date: string;
  valueDate: string | null;
  words: string[];
  amount: number | null;
  balanceAfter: number | null;
  row: Row;
  continued: number;
}

interface Draft {
  account: StatementAccount | null;
  lines: RawLine[];
  balancesBefore: StatementBalance[];
  balancesAfter: StatementBalance[];
  totals: StatementTotals | null;
  totalsSeen: number;
  sawSign: boolean;
  amountColumn: boolean;
}

function newDraft(account: StatementAccount | null, amountColumn: boolean): Draft {
  return {
    account,
    lines: [],
    balancesBefore: [],
    balancesAfter: [],
    totals: null,
    totalsSeen: 0,
    sawSign: false,
    amountColumn,
  };
}

/** A row that names an account, as the title of its table does. */
const ACCOUNT_ROW =
  /^(?:iban|rib|compte|n[°o]\.?\s*(?:de\s+)?compte|num[eé]ro\s+de\s+compte|account|votre\s+compte|relev[eé]\s+de\s+compte|livret|plan\s+d.[eé]pargne)/i;

/** The most a line's words run onto the rows below it. */
const MAX_CONTINUED = 4;

/** A statement's pages, as positioned text, read as its lines. */
export function readPdfPages(
  pages: readonly PdfPage[],
  { today }: { today: string },
): Statement {
  const rows = rowsOf(pages);
  if (rows.length === 0) {
    return {
      format: "pdf",
      bank: null,
      blocks: [],
      skipped: 0,
      problem: pages.length === 0 ? "unreadable" : "scanned",
      table: null,
    };
  }

  const allText = rows.map((row) => row.text).join("\n");
  const period = periodOf(allText);
  const latestFull = [...allText.matchAll(FULL_DATE)]
    .map((match) => strictDate(match[1]!))
    .filter((date): date is string => date !== null && date <= today)
    .sort()
    .pop();
  const anchorDate = period?.to ?? latestFull ?? today;
  const anchor = {
    year: Number(anchorDate.slice(0, 4)),
    month: Number(anchorDate.slice(5, 7)),
  };

  // Whether the statement names its columns anywhere: the reading by
  // columns, else the looser one — a date first, an amount last.
  let headerFound = false;
  for (let index = 0; index < rows.length && !headerFound; index += 1) {
    headerFound =
      headerOf(rows[index]!.cells) !== null ||
      (rows[index + 1] !== undefined &&
        headerOf(stacked(rows[index]!, rows[index + 1]!)) !== null);
  }

  // Without named columns, amounts carry their own sign, or none.
  const drafts: Draft[] = [newDraft(null, !headerFound)];
  let draft = drafts[0]!;
  let columns: Column[] | null = null;
  let pending: Pending | null = null;
  let skipped = 0;
  let firstHeaderSeen = false;
  const above: string[] = [];

  const finish = () => {
    if (!pending) return;
    if (pending.amount === null) {
      skipped += 1;
    } else {
      const line = makeLine({
        date: pending.date,
        valueDate: pending.valueDate,
        amount: pending.amount,
        label: pending.words.join(" "),
        currency: "EUR",
        balanceAfter: pending.balanceAfter,
      });
      if (line) {
        draft.lines.push(line);
        draft.balancesAfter = [];
      }
    }
    pending = null;
  };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const next = rows[index + 1];

    const header =
      headerOf(row.cells) ??
      (next && next.page === row.page && next.y - row.y <= row.height * 1.6
        ? headerOf(stacked(row, next))
        : null);
    if (header) {
      finish();
      if (!headerOf(row.cells)) index += 1;
      columns = header;
      firstHeaderSeen = true;
      if (header.some((column) => column.kind === "amount") &&
          !header.some((column) => column.kind === "debit")) {
        draft.amountColumn = true;
      }
      continue;
    }
    if (!firstHeaderSeen) {
      above.push(row.text);
    }

    const { amounts, rest } = amountsOf(
      row,
      headerFound ? columns : null,
    );
    const role = rowRole(row.text);

    if (role && amounts.length > 0) {
      finish();
      if (role === "balance") {
        const balance = balanceOf(row, amounts, anchor);
        if (balance) {
          if (draft.lines.length === 0) draft.balancesBefore.push(balance);
          else draft.balancesAfter.push(balance);
        }
      } else if (role === "total") {
        const out = amounts.find((amount) => amount.kind === "debit");
        const into = amounts.find((amount) => amount.kind === "credit");
        draft.totalsSeen += 1;
        if (out && into) {
          draft.totals = {
            out: decimalOf(Math.abs(out.value)),
            in: decimalOf(Math.abs(into.value)),
          };
        }
      }
      continue;
    }

    // The date a line starts with, in the date column.
    const first = rest[0];
    const dateColumn = columns?.find((column) => column.kind === "date") ?? null;
    const afterDate = columns
      ?.filter((column) => column.kind !== "date" && column.x0 > (dateColumn?.x0 ?? -1))
      .sort((a, b) => a.x0 - b.x0)[0];
    const inDateColumn =
      first !== undefined &&
      (!headerFound ||
        (columns !== null && first.x0 < (afterDate?.x0 ?? Infinity) - 2));
    const start = inDateColumn && first ? dateAtStart(first.text) : null;
    const startDate =
      start && (headerFound || start.year !== null) ? dateIn(start, anchor) : null;

    if (startDate && (!headerFound || columns)) {
      finish();
      let label = first!.text.slice(start!.length).trim();
      let valueDate: string | null = null;
      const second = dateAtStart(label);
      if (second) {
        valueDate = dateIn(second, anchor);
        label = label.slice(second.length).trim();
      }
      const words = label ? [label] : [];
      for (const cell of rest.slice(1)) {
        const dated = dateAtStart(cell.text);
        const column = columns?.find(
          (one) => one.kind === "valueDate" && Math.abs(one.x0 - cell.x0) < 40,
        );
        if (column && dated && dated.length >= cell.text.length - 1) {
          valueDate = dateIn(dated, anchor);
        } else {
          words.push(cell.text);
        }
      }
      const money = amounts.find((amount) => amount.kind !== "balance");
      const balance = amounts.find((amount) => amount.kind === "balance");
      pending = {
        date: startDate,
        valueDate,
        words,
        amount: money ? signedValue(money) : null,
        balanceAfter: balance ? balance.value : null,
        row,
        continued: 0,
      };
      if (money?.signed) draft.sawSign = true;
      if (money && money.kind !== "amount") draft.sawSign = true;
      continue;
    }

    // The words of the line above, run onto this row.
    const open = pending as Pending | null;
    if (
      open &&
      open.row.page === row.page &&
      row.y - open.row.y <= Math.max(row.height, open.row.height) * 2.4 &&
      open.continued < MAX_CONTINUED &&
      !role &&
      first !== undefined &&
      (afterDate ? first.x0 >= afterDate.x0 - 3 : true)
    ) {
      const money = amounts.find((amount) => amount.kind !== "balance");
      if (amounts.length === 0 || (open.amount === null && money)) {
        open.words.push(rest.map((cell) => cell.text).join(" "));
        if (money && open.amount === null) {
          open.amount = signedValue(money);
          if (money.signed || money.kind !== "amount") draft.sawSign = true;
        }
        open.row = row;
        open.continued += 1;
        continue;
      }
    }

    finish();
    // An account named between tables: its lines start a block of their own.
    if (ACCOUNT_ROW.test(row.text.trim()) && amounts.length === 0) {
      const account = accountIn(row.text);
      if (account && !sameAccount(account, draft.account)) {
        if (draft.lines.length > 0) {
          draft = newDraft(account, !headerFound);
          drafts.push(draft);
        } else {
          draft.account = account;
        }
      }
    }
  }
  finish();
  // An account the page names above its first table, however it words it.
  drafts[0]!.account ??= accountIn(above.join("\n"));

  const bank =
    bankFromText(above.join("\n")) ??
    bankFromIban(drafts.find((one) => one.account?.iban)?.account?.iban) ??
    bankFromText(allText);

  const blocks = drafts
    .filter((one) => one.lines.length > 0)
    .map((one) => blockOf(one, drafts.length === 1 ? period : null));

  return {
    format: "pdf",
    bank,
    blocks,
    skipped,
    problem: blocks.length === 0 ? "unreadable" : null,
    table: null,
  };
}

function signedValue(amount: Amount): number {
  if (amount.kind === "debit") return -Math.abs(amount.value);
  if (amount.kind === "credit") return Math.abs(amount.value);
  return amount.value;
}

/**
 * A block, its balances held to its lines: the opening and closing ones
 * kept only when the lines join them to the cent, or when the totals do.
 */
function blockOf(
  draft: Draft,
  period: { from: string; to: string } | null,
): StatementBlock {
  const lines: BankTransaction[] = withLineIds(draft.lines);
  const days = lines
    .map((line) => line.bookingDate)
    .filter((day): day is string => day !== null)
    .sort();
  const signUnknown = draft.amountColumn && !draft.sawSign;
  const balances = [...draft.balancesBefore, ...draft.balancesAfter];
  const joined = signUnknown ? null : joiningBalances(balances, lines);

  let check: StatementCheck | null = null;
  if (joined) {
    check = { ok: true, gap: "0.00" };
  } else if (draft.totals && draft.totalsSeen === 1 && !signUnknown) {
    check = checkTotals(lines, draft.totals);
  } else if (balances.length >= 2 && !signUnknown) {
    check = checkBlock({
      account: null,
      currency: "EUR",
      from: null,
      to: null,
      opening: draft.balancesBefore[0] ?? balances[0]!,
      closing: draft.balancesAfter[draft.balancesAfter.length - 1] ?? balances[balances.length - 1]!,
      lines,
      signUnknown,
    });
  }

  return {
    account: draft.account,
    currency: "EUR",
    from: period?.from ?? days[0] ?? null,
    to: period?.to ?? days[days.length - 1] ?? null,
    opening: joined?.opening ?? null,
    closing: joined?.closing ?? (check?.ok ? (draft.balancesAfter.at(-1) ?? null) : null),
    lines,
    signUnknown,
    check,
  };
}
