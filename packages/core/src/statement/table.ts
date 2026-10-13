import {
  bankFromHeader,
  bankFromIban,
  bankFromText,
  type BankId,
} from "./banks";
import { withLineIds } from "./line-ids";
import {
  NO_ACCOUNT,
  type RawLine,
  type StatementAccount,
  type StatementBalance,
  type StatementBlock,
  type StatementProblem,
} from "./model";
import {
  dateOrderOf,
  decimalOf,
  strictAmount,
  strictDate,
  type DateOrder,
} from "./values";

/**
 * A table of cells — a CSV, a spreadsheet's first sheet, a table pasted
 * from a bank's website — read as one account's lines.
 *
 * The columns are found by their names where the file has a header, in
 * French or English, and checked against what they hold; where there is no
 * header, or its names say nothing, by what they hold alone: the column of
 * dates, the column (or the two, debit and credit) of amounts, the running
 * balance that follows them, the longest words. A file that cannot be read
 * either way is handed back as its rows, for the person to say which column
 * is which — once.
 *
 * The lines above a header are read too: the account's IBAN or number, the
 * bank's name, and the balances banks write there (« Solde au 30/09/2026 »).
 */

/** The roles a column can play. */
interface Columns {
  date: number | null;
  valueDate: number | null;
  label: number | null;
  detail: number | null;
  payee: number | null;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  /** « D »/« C », « Débit »/« Crédit », « DBIT »/« CRDT »: the sign, apart. */
  direction: number | null;
  balance: number | null;
  currency: number | null;
  /** Revolut's « State »: only completed lines are money that moved. */
  state: number | null;
  /** Revolut's « Fee », charged on top of the amount. */
  fee: number | null;
  /** BoursoBank's export holds every account, each line naming its own. */
  account: number | null;
  accountName: number | null;
}

const NO_COLUMNS: Columns = {
  date: null,
  valueDate: null,
  label: null,
  detail: null,
  payee: null,
  amount: null,
  debit: null,
  credit: null,
  direction: null,
  balance: null,
  currency: null,
  state: null,
  fee: null,
  account: null,
  accountName: null,
};

/** Header words for each role, most telling first. Accents and case aside. */
const HINTS: Record<keyof Columns, string[]> = {
  date: [
    "date operation",
    "date de l operation",
    "date de operation",
    "date de comptabilisation",
    "date comptable",
    "dateop",
    "completed date",
    "booking date",
    "settlement date",
    "transaction date",
    "date",
    "started date",
    "operation date",
  ],
  valueDate: ["date de valeur", "date valeur", "dateval", "value date"],
  label: [
    "libelle operation",
    "libelle de l operation",
    "libelle",
    "label",
    "description",
    "libelle simplifie",
    "libelle court",
    "nature de l operation",
    "nature",
    "details",
    "narrative",
    "reference",
    "intitule",
    "operation",
    "note",
  ],
  detail: [
    "detail de l ecriture",
    "informations complementaires",
    "detail",
    "payment reference",
    "communication",
    "memo",
  ],
  payee: [
    "supplierfound",
    "partner name",
    "payee",
    "counterparty name",
    "beneficiaire",
    "tiers",
    "merchant",
  ],
  amount: [
    "montant de l operation",
    "montant operation",
    "montant euros",
    "montant eur",
    "montant",
    "amount eur",
    "total amount incl vat",
    "amount",
    "somme",
    "valeur",
    "betrag",
    "importo",
  ],
  debit: [
    "debit euros",
    "debit eur",
    "debit",
    "debits",
    "montant debit",
    "depense",
    "depenses",
    "sortie",
    "sorties",
    "withdrawal",
    "money out",
    "paid out",
  ],
  credit: [
    "credit euros",
    "credit eur",
    "credit",
    "credits",
    "montant credit",
    "recette",
    "recettes",
    "entree",
    "entrees",
    "deposit",
    "money in",
    "paid in",
  ],
  // « Type » last: Pluclair's own export says Dépense or Revenu there; a
  // bank's « Type » (« Carte », « CARD_PAYMENT ») says nothing of the sign,
  // and is then not read as one.
  direction: ["sens", "debit credit", "type de mouvement", "d c", "dc", "type"],
  // Not BoursoBank's « accountbalance »: the account's balance on the day
  // of the export, the same on every line, not the balance after each.
  balance: ["solde", "balance", "solde apres operation", "nouveau solde"],
  currency: ["devise", "currency", "monnaie"],
  state: ["state", "statut", "status"],
  fee: ["fee", "frais", "commission"],
  account: ["accountnum"],
  accountName: ["accountlabel"],
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The column whose name is one of `hints`: exact names first, then a name holding one. */
function columnNamed(
  header: readonly string[],
  hints: readonly string[],
  taken: ReadonlySet<number>,
): number | null {
  const names = header.map(normalize);
  for (const hint of hints) {
    const exact = names.findIndex(
      (name, index) => name === hint && !taken.has(index),
    );
    if (exact !== -1) {
      return exact;
    }
  }
  for (const hint of hints) {
    if (hint.length < 4) {
      continue;
    }
    const partial = names.findIndex(
      (name, index) => !taken.has(index) && name.includes(hint),
    );
    if (partial !== -1) {
      return partial;
    }
  }
  return null;
}

/** Columns no role reads, whatever their names hold. */
const IGNORED = new Set(["accountbalance", "category", "categoryparent"]);

/** The roles a header names, each column used once, most specific roles first. */
function columnsFromHeader(header: readonly string[]): Columns {
  const columns: Columns = { ...NO_COLUMNS };
  const taken = new Set<number>(
    header.flatMap((name, index) =>
      IGNORED.has(normalize(name)) ? [index] : [],
    ),
  );
  const order: (keyof Columns)[] = [
    "account",
    "accountName",
    "valueDate",
    "date",
    "debit",
    "credit",
    "balance",
    "amount",
    "direction",
    "currency",
    "state",
    "fee",
    "payee",
    "detail",
    "label",
  ];
  for (const role of order) {
    const found = columnNamed(header, HINTS[role], taken);
    if (found !== null) {
      columns[role] = found;
      taken.add(found);
    }
  }
  // A lone « Date » taken as the value date leaves no operation date.
  if (columns.date === null && columns.valueDate !== null) {
    columns.date = columns.valueDate;
    columns.valueDate = null;
  }
  // Split columns only where there is no single amount.
  if (
    columns.amount !== null &&
    (columns.debit !== null || columns.credit !== null)
  ) {
    const debitAndCredit = columns.debit !== null && columns.credit !== null;
    if (debitAndCredit) {
      columns.amount = null;
    } else {
      columns.debit = null;
      columns.credit = null;
    }
  }
  return columns;
}

/** Whether a row names a date column and a money column: a header. */
function namesColumns(row: readonly string[]): boolean {
  if (row.some((cell) => strictDate(cell) !== null)) {
    return false;
  }
  const columns = columnsFromHeader(row);
  return (
    columns.date !== null &&
    (columns.amount !== null ||
      columns.debit !== null ||
      columns.credit !== null)
  );
}

/** How far down a header is looked for. */
const HEADER_SEARCH_ROWS = 30;

function cell(row: readonly string[], index: number | null): string {
  return index === null ? "" : (row[index] ?? "").trim();
}

function share(
  rows: readonly string[][],
  index: number,
  test: (value: string) => boolean,
): { filled: number; passing: number } {
  let filled = 0;
  let passing = 0;
  for (const row of rows) {
    const value = cell(row, index);
    if (value === "") {
      continue;
    }
    filled += 1;
    if (test(value)) {
      passing += 1;
    }
  }
  return { filled, passing };
}

/**
 * Whether `balance` runs alongside `amount`: each balance is the one before
 * plus (or, newest first, minus) the amount. What tells a running balance
 * from the amount column it sits next to.
 */
function runsAsBalance(
  rows: readonly string[][],
  balance: number,
  amount: (row: readonly string[]) => number | null,
): boolean {
  let checked = 0;
  let agreeing = 0;
  for (let index = 1; index < rows.length && checked < 40; index += 1) {
    const before = strictAmount(cell(rows[index - 1]!, balance));
    const now = strictAmount(cell(rows[index]!, balance));
    const moved = amount(rows[index]!);
    const movedBefore = amount(rows[index - 1]!);
    if (
      before === null ||
      now === null ||
      moved === null ||
      movedBefore === null
    ) {
      continue;
    }
    checked += 1;
    if (
      Math.abs(before + moved - now) < 0.005 ||
      Math.abs(now + movedBefore - before) < 0.005
    ) {
      agreeing += 1;
    }
  }
  return checked >= 2 && agreeing / checked >= 0.8;
}

/** The roles of a header-less table, read from what its columns hold. */
function columnsFromContent(rows: readonly string[][]): Columns | null {
  const sample = rows.slice(0, 300);
  const width = Math.max(0, ...sample.map((row) => row.length));
  const columns: Columns = { ...NO_COLUMNS };

  const dates: number[] = [];
  const money: number[] = [];
  const text: { index: number; length: number }[] = [];
  for (let index = 0; index < width; index += 1) {
    const order = dateOrderOf(sample.map((row) => cell(row, index)));
    const dated = share(
      sample,
      index,
      (value) => strictDate(value, order) !== null,
    );
    if (
      dated.filled >= sample.length * 0.9 &&
      dated.passing >= dated.filled * 0.9
    ) {
      dates.push(index);
      continue;
    }
    const amounts = share(
      sample,
      index,
      (value) => strictAmount(value) !== null,
    );
    if (
      amounts.filled >= sample.length * 0.25 &&
      amounts.passing >= amounts.filled * 0.9
    ) {
      money.push(index);
      continue;
    }
    let total = 0;
    let filled = 0;
    for (const row of sample) {
      const value = cell(row, index);
      if (value) {
        total += value.length;
        filled += 1;
      }
    }
    if (filled > 0) {
      text.push({ index, length: total / filled });
    }
  }

  if (dates.length === 0 || money.length === 0) {
    return null;
  }
  columns.date = dates[0]!;
  columns.valueDate = dates[1] ?? null;

  const fullAmount = money.filter((index) => {
    const filled = share(sample, index, () => true).filled;
    return filled >= sample.length * 0.9;
  });

  // Two money columns that are never both filled: debit and credit.
  const complementary = (a: number, b: number) =>
    sample.filter((row) => cell(row, a) !== "" && cell(row, b) !== "").length <=
      sample.length * 0.05 &&
    sample.filter((row) => cell(row, a) !== "" || cell(row, b) !== "").length >=
      sample.length * 0.9;

  let split: [number, number] | null = null;
  for (let i = 0; i < money.length && !split; i += 1) {
    for (let j = i + 1; j < money.length && !split; j += 1) {
      if (complementary(money[i]!, money[j]!)) {
        split = [money[i]!, money[j]!];
      }
    }
  }

  if (split) {
    // A column written with minus signs is the debit; else French order:
    // « Débit » before « Crédit ».
    const negatives = (index: number) =>
      sample.filter((row) => (strictAmount(cell(row, index)) ?? 0) < 0).length;
    const [first, second] = split;
    const swap = negatives(second) > negatives(first);
    columns.debit = swap ? second : first;
    columns.credit = swap ? first : second;
    const rest = fullAmount.filter(
      (index) => index !== first && index !== second,
    );
    columns.balance = rest[0] ?? null;
  } else if (fullAmount.length >= 1) {
    if (fullAmount.length === 1) {
      columns.amount = fullAmount[0]!;
    } else {
      // An amount and a running balance: the balance follows the amount.
      const [a, b] = fullAmount as [number, number];
      const read = (index: number) => (row: readonly string[]) =>
        strictAmount(cell(row, index));
      if (runsAsBalance(sample, b, read(a))) {
        columns.amount = a;
        columns.balance = b;
      } else if (runsAsBalance(sample, a, read(b))) {
        columns.amount = b;
        columns.balance = a;
      } else {
        return null;
      }
    }
  } else {
    return null;
  }

  const label = text.sort((x, y) => y.length - x.length)[0];
  columns.label = label?.index ?? null;
  return columns;
}

/**
 * A label and its detail as one: the longer alone when it holds the other
 * (Société Générale's detail repeats the label, with more), both otherwise.
 */
function joinWords(label: string, detail: string): string {
  const a = normalize(label);
  const b = normalize(detail);
  if (!b || a.includes(b)) {
    return label;
  }
  if (!a || b.includes(a)) {
    return detail;
  }
  return `${label} ${detail}`;
}

/** « D », « Débit », « DBIT », « - »: money out. Null when the cell says nothing. */
function directionOf(value: string): "in" | "out" | null {
  const word = normalize(value);
  if (
    value.trim() === "-" ||
    /^(d|db|dbit|debit|debiteur|sortie|out|expense|depense|spending|savings|epargne|investment|investissement)$/.test(
      word,
    )
  ) {
    return "out";
  }
  if (
    value.trim() === "+" ||
    /^(c|cr|crdt|credit|crediteur|entree|in|income|revenu|revenus|recette)$/.test(
      word,
    )
  ) {
    return "in";
  }
  return null;
}

/** States of a line that did not move money (Revolut's « State »). */
const NOT_MOVED = new Set([
  "reverted",
  "declined",
  "failed",
  "pending",
  "en attente",
  "annule",
  "rejete",
]);

export const IBAN_IN_TEXT =
  /\b([A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?)\b/;
export const ACCOUNT_NUMBER_IN_TEXT =
  /(?:(?:n[°o]\.?|num[ée]ro)\s*(?:de\s+)?compte|(?:compte|account)\b[^:;\n]{0,40}?(?:n[°o]\.?|number|no\.?))\s*[:;]?\s*(\d[\d ]{4,22}\d(?:[A-Z]\d{2,3})?)/i;
const BALANCE_WORD = /\bsolde\b/i;
const DATE_IN_TEXT = /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/;
const AMOUNT_IN_TEXT =
  /[+-]?\s?\d[\d \u00a0\u202f.,]*\d(?:\s?(?:€|eur(?:os)?))?/gi;

/**
 * « Solde au 13/10/2026 : 1 234,56 € », « Solde (EUROS) ;1 234,56 »: the
 * balance a line states, its date apart first so that the day is never
 * taken for the amount.
 */
function balanceIn(line: string): StatementBalance | null {
  const at = line.search(BALANCE_WORD);
  if (at === -1) {
    return null;
  }
  let rest = line.slice(at + 5);
  const date = DATE_IN_TEXT.exec(rest);
  if (date) {
    rest =
      rest.slice(0, date.index) + " " + rest.slice(date.index + date[0].length);
  }
  const amounts = [...rest.matchAll(AMOUNT_IN_TEXT)]
    .map((match) => strictAmount(match[0]))
    .filter((amount): amount is number => amount !== null);
  const amount = amounts[amounts.length - 1];
  return amount === undefined
    ? null
    : { date: date ? strictDate(date[1]!) : null, amount: decimalOf(amount) };
}

function scanPreamble(lines: readonly string[]): {
  account: StatementAccount | null;
  balance: StatementBalance | null;
} {
  let iban: string | null = null;
  let number: string | null = null;
  let balance: StatementBalance | null = null;
  for (const raw of lines) {
    const line = raw.replace(/["=]/g, " ");
    const foundIban = IBAN_IN_TEXT.exec(line.toUpperCase());
    if (!iban && foundIban && foundIban[1]!.replace(/\s/g, "").length >= 15) {
      iban = foundIban[1]!.replace(/\s/g, "");
    }
    const foundNumber = ACCOUNT_NUMBER_IN_TEXT.exec(line);
    if (!number && foundNumber) {
      number = foundNumber[1]!.replace(/\s/g, "");
    }
    balance ??= balanceIn(line);
  }
  return {
    account:
      iban || number
        ? { ...NO_ACCOUNT, iban, number: iban ? null : number }
        : null,
    balance,
  };
}

/** One line, as the bank feed takes it. */
export function makeLine(input: {
  date: string;
  valueDate?: string | null;
  transactionDate?: string | null;
  amount: number;
  label: string;
  counterparty?: string | null;
  counterpartyIban?: string | null;
  currency: string;
  balanceAfter?: number | null;
}): RawLine | null {
  if (!Number.isFinite(input.amount) || Math.abs(input.amount) < 0.005) {
    return null;
  }
  const out = input.amount < 0;
  const counterparty = input.counterparty?.trim() || null;
  const iban =
    input.counterpartyIban?.replace(/\s+/g, "").toUpperCase() || null;
  return {
    amount: decimalOf(Math.abs(input.amount)),
    currency: input.currency,
    creditDebitIndicator: out ? "DBIT" : "CRDT",
    bookingDate: input.date,
    valueDate: input.valueDate ?? null,
    transactionDate: input.transactionDate ?? null,
    creditorName: out ? counterparty : null,
    creditorIban: out ? iban : null,
    debtorName: out ? null : counterparty,
    debtorIban: out ? null : iban,
    remittanceInformation: input.label.replace(/\s+/g, " ").trim() || null,
    merchantCategoryCode: null,
    balanceAfterTransaction:
      input.balanceAfter === null || input.balanceAfter === undefined
        ? null
        : decimalOf(input.balanceAfter),
  };
}

export interface TableReading {
  bank: BankId | null;
  blocks: StatementBlock[];
  skipped: number;
  problem: StatementProblem | null;
  table: string[][] | null;
}

function emptyRow(row: readonly string[]): boolean {
  return row.every((value) => value.trim() === "");
}

/**
 * `rows` read as lines. `preamble` is text that came before the table (a
 * spreadsheet's title rows, a pasted page's heading), searched like the
 * lines above a header.
 */
export function readTable(
  rows: readonly string[][],
  { defaultCurrency = "EUR", preamble = "" } = {},
): TableReading {
  const table = rows.filter((row) => !emptyRow(row)).map((row) => [...row]);
  if (table.length === 0) {
    return {
      bank: null,
      blocks: [],
      skipped: 0,
      problem: "empty",
      table: null,
    };
  }

  let headerAt: number | null = null;
  for (
    let index = 0;
    index < Math.min(table.length, HEADER_SEARCH_ROWS);
    index += 1
  ) {
    if (namesColumns(table[index]!)) {
      headerAt = index;
      break;
    }
  }

  const above = headerAt === null ? [] : table.slice(0, headerAt);
  const data = headerAt === null ? table : table.slice(headerAt + 1);
  const header = headerAt === null ? null : table[headerAt]!;

  let columns: Columns | null = header ? columnsFromHeader(header) : null;
  // Names that do not hold what they say are not believed.
  if (columns) {
    const order = dateOrderOf(data.map((row) => cell(row, columns!.date)));
    const dated = share(
      data,
      columns.date!,
      (value) => strictDate(value, order) !== null,
    );
    if (dated.filled === 0 || dated.passing < dated.filled * 0.7) {
      columns = null;
    }
  }
  columns ??= columnsFromContent(data);
  if (!columns || columns.date === null) {
    return { bank: null, blocks: [], skipped: 0, problem: "columns", table };
  }

  const preambleText = [preamble, ...above.map((row) => row.join(" "))].join(
    "\n",
  );
  const scanned = scanPreamble(preambleText.split("\n"));
  const bank =
    (header ? bankFromHeader(header) : null) ??
    bankFromIban(scanned.account?.iban) ??
    bankFromText(preambleText);

  return blocksFrom(data, columns, {
    bank,
    scanned,
    defaultCurrency,
    table,
  });
}

/** The lines of `data` under `columns`, grouped by account. */
function blocksFrom(
  data: readonly string[][],
  columns: Columns,
  {
    bank,
    scanned,
    defaultCurrency,
    table,
  }: {
    bank: BankId | null;
    scanned: ReturnType<typeof scanPreamble>;
    defaultCurrency: string;
    table: string[][];
  },
): TableReading {
  const order = dateOrderOf(data.map((row) => cell(row, columns.date)));
  const valueOrder = dateOrderOf(
    data.map((row) => cell(row, columns.valueDate)),
  );
  const lines = new Map<
    string,
    { account: StatementAccount | null; currency: string; lines: RawLine[] }
  >();
  const split = columns.debit !== null || columns.credit !== null;
  // A direction column counts once a line has said which way it went.
  let directionSeen = false;
  let anyNegative = false;
  let skipped = 0;

  for (const row of data) {
    const state = normalize(cell(row, columns.state));
    if (state && NOT_MOVED.has(state)) {
      continue;
    }
    const date = strictDate(cell(row, columns.date), order);
    if (!date) {
      // A totals or a balance line under the table is not a lost row.
      const words = normalize(row.join(" "));
      if (
        row.some((value) => strictAmount(value) !== null) &&
        !/total|solde|balance/.test(words)
      ) {
        skipped += 1;
      }
      continue;
    }

    let amount: number | null;
    if (columns.amount !== null) {
      amount = strictAmount(cell(row, columns.amount));
      const direction = directionOf(cell(row, columns.direction));
      if (amount !== null && direction) {
        directionSeen = true;
        amount = direction === "out" ? -Math.abs(amount) : Math.abs(amount);
      }
    } else {
      const debit = strictAmount(cell(row, columns.debit));
      const credit = strictAmount(cell(row, columns.credit));
      amount =
        debit !== null && debit !== 0
          ? -Math.abs(debit)
          : credit !== null
            ? Math.abs(credit)
            : null;
    }
    const fee = strictAmount(cell(row, columns.fee));
    if (amount !== null && fee !== null && fee !== 0) {
      amount -= Math.abs(fee);
    }
    if (amount === null) {
      skipped += 1;
      continue;
    }
    if (amount < 0) {
      anyNegative = true;
    }

    const label = joinWords(
      cell(row, columns.label),
      cell(row, columns.detail),
    );
    const currency = cell(row, columns.currency).toUpperCase();
    const accountKey = cell(row, columns.account);
    const made = makeLine({
      date,
      valueDate: strictDate(cell(row, columns.valueDate), valueOrder),
      amount,
      label: label || cell(row, columns.payee),
      counterparty: cell(row, columns.payee) || null,
      currency: /^[A-Z]{3}$/.test(currency) ? currency : defaultCurrency,
      balanceAfter: strictAmount(cell(row, columns.balance)),
    });
    if (!made) {
      continue;
    }
    const group = lines.get(accountKey) ?? {
      account: accountKey
        ? {
            ...NO_ACCOUNT,
            number: accountKey.replace(/\s/g, ""),
            name: cell(row, columns.accountName) || null,
          }
        : scanned.account,
      currency: made.currency,
      lines: [],
    };
    group.lines.push(made);
    lines.set(accountKey, group);
  }

  if (lines.size === 0) {
    return {
      bank,
      blocks: [],
      skipped,
      problem: skipped > 0 ? "columns" : "empty",
      table: skipped > 0 ? table : null,
    };
  }

  const blocks: StatementBlock[] = [...lines.values()].map((group) => {
    const days = group.lines.map((line) => line.bookingDate!).sort();
    return {
      account: group.account,
      currency: group.currency,
      from: days[0] ?? null,
      to: days[days.length - 1] ?? null,
      opening: null,
      closing: lines.size === 1 ? scanned.balance : null,
      lines: withLineIds(group.lines),
      signUnknown: !split && !directionSeen && !anyNegative,
    };
  });
  return { bank, blocks, skipped, problem: null, table: null };
}

/** Which column is which, as the person said when the file could not. */
export interface TableMapping {
  /** Whether the first row names the columns rather than holding a line. */
  header: boolean;
  date: number;
  label: number;
  /** A signed amount, or else debit and credit apart. */
  amount: number | null;
  debit: number | null;
  credit: number | null;
}

/** A table read under the columns the person named (`problem: "columns"`). */
export function readMappedTable(
  rows: readonly string[][],
  mapping: TableMapping,
  { defaultCurrency = "EUR" } = {},
): TableReading {
  const table = rows.filter((row) => !emptyRow(row)).map((row) => [...row]);
  const data = mapping.header ? table.slice(1) : table;
  return blocksFrom(
    data,
    {
      ...NO_COLUMNS,
      date: mapping.date,
      label: mapping.label,
      amount: mapping.amount,
      debit: mapping.amount === null ? mapping.debit : null,
      credit: mapping.amount === null ? mapping.credit : null,
    },
    {
      bank: mapping.header ? bankFromHeader(table[0] ?? []) : null,
      scanned: { account: null, balance: null },
      defaultCurrency,
      table,
    },
  );
}
