import { normalizeRuleWords } from "./filing-rules";
import type { InvestmentWalletId } from "./investments";
import { dateOrderOf, strictDate } from "./statement/values";
import type {
  InvestmentEventKind,
  InvestmentEventSource,
} from "./types/database";

/**
 * What happened inside a wallet (migration 080): a buy, a sell, a dividend,
 * a fee — and what follows from a run of them: the realised gains per
 * wrapper and year, first in first out, and the dividends received.
 *
 * Typed by hand, or read off a broker's export (`readBrokerRows`): the
 * columns found by their names in French or English, the kind by the words
 * of the line, each line known again by its fingerprint. Built on
 * synthetic exports and said so: a real one, anonymised, is the owner's
 * part. Pure: the rows are `@finance/data/investment-events`'s.
 */

export type EventKind = InvestmentEventKind;

export const EVENT_KINDS: readonly EventKind[] = [
  "buy",
  "sell",
  "dividend",
  "fee",
];

export interface InvestmentEvent {
  id: string;
  wallet: InvestmentWalletId;
  kind: EventKind;
  /** YYYY-MM-DD. */
  occurredOn: string;
  instrumentName: string | null;
  instrumentSymbol: string | null;
  isin: string | null;
  /** Shares or units moved, for a buy or a sell. */
  quantity: number | null;
  /** The cash that moved, never signed. */
  amount: number;
  note: string | null;
  source: InvestmentEventSource;
}

/** An event as read off a file, before it is stored. */
export type ReadEvent = Omit<InvestmentEvent, "id" | "source"> & {
  fingerprint: string;
};

/** To the cent. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function yearOf(event: { occurredOn: string }): number {
  return Number(event.occurredOn.slice(0, 4));
}

/* ------------------------------------------------------ what each holds */

/** The instrument an event is about, as the gains are grouped: ISIN, symbol, or name. */
export function instrumentKey(event: {
  isin: string | null;
  instrumentSymbol: string | null;
  instrumentName: string | null;
}): string {
  if (event.isin) {
    return event.isin.toUpperCase();
  }
  if (event.instrumentSymbol) {
    return event.instrumentSymbol.toUpperCase();
  }
  return normalizeRuleWords(event.instrumentName ?? "");
}

export interface RealisedGain {
  wallet: InvestmentWalletId;
  year: number;
  /** What the sells brought in. */
  proceeds: number;
  /** What the shares sold had cost, first in first out, where the buys are known. */
  basis: number;
  gain: number;
  /** Sells whose buys are not all among the events: their basis is short. */
  uncoveredSells: number;
}

/**
 * The realised gains, per wrapper and year: each sell against the oldest
 * buys of the same instrument in the same wallet still unsold (first in,
 * first out, as French tax reads a PEA or a CTO). A sell with no buy
 * behind it, or no quantity, is counted at its proceeds and said to be
 * uncovered, so a figure resting on a buy nobody recorded is never drawn
 * as a gain without a word.
 */
export function realisedGains(
  events: readonly InvestmentEvent[],
): RealisedGain[] {
  const ordered = [...events].sort(
    (a, b) =>
      a.occurredOn.localeCompare(b.occurredOn) ||
      // A buy and a sell the same day: the buy first.
      (a.kind === "buy" ? 0 : 1) - (b.kind === "buy" ? 0 : 1) ||
      a.id.localeCompare(b.id),
  );
  /** Open lots, oldest first, per wallet and instrument. */
  const lots = new Map<string, { quantity: number; cost: number }[]>();
  const gains = new Map<string, RealisedGain>();

  for (const event of ordered) {
    const key = `${event.wallet}|${instrumentKey(event)}`;
    if (event.kind === "buy") {
      if (event.quantity && event.quantity > 0) {
        lots.set(key, [
          ...(lots.get(key) ?? []),
          { quantity: event.quantity, cost: event.amount },
        ]);
      }
      continue;
    }
    if (event.kind !== "sell") {
      continue;
    }
    const year = yearOf(event);
    const gainKey = `${event.wallet}|${year}`;
    const entry = gains.get(gainKey) ?? {
      wallet: event.wallet,
      year,
      proceeds: 0,
      basis: 0,
      gain: 0,
      uncoveredSells: 0,
    };
    entry.proceeds = roundMoney(entry.proceeds + event.amount);

    let toCover = event.quantity ?? 0;
    let basis = 0;
    const open = lots.get(key) ?? [];
    while (toCover > 1e-9 && open.length > 0) {
      const lot = open[0]!;
      const taken = Math.min(lot.quantity, toCover);
      const cost = (lot.cost * taken) / lot.quantity;
      basis += cost;
      lot.cost -= cost;
      lot.quantity -= taken;
      toCover -= taken;
      if (lot.quantity <= 1e-9) {
        open.shift();
      }
    }
    lots.set(key, open);
    if (toCover > 1e-9 || !event.quantity) {
      entry.uncoveredSells += 1;
    }
    entry.basis = roundMoney(entry.basis + basis);
    entry.gain = roundMoney(entry.proceeds - entry.basis);
    gains.set(gainKey, entry);
  }

  return [...gains.values()].sort(
    (a, b) => b.year - a.year || a.wallet.localeCompare(b.wallet),
  );
}

export interface YearlyCash {
  wallet: InvestmentWalletId;
  year: number;
  amount: number;
}

function cashByYear(
  events: readonly InvestmentEvent[],
  kind: EventKind,
): YearlyCash[] {
  const sums = new Map<string, YearlyCash>();
  for (const event of events) {
    if (event.kind !== kind) {
      continue;
    }
    const year = yearOf(event);
    const key = `${event.wallet}|${year}`;
    const entry = sums.get(key) ?? { wallet: event.wallet, year, amount: 0 };
    entry.amount = roundMoney(entry.amount + event.amount);
    sums.set(key, entry);
  }
  return [...sums.values()].sort(
    (a, b) => b.year - a.year || a.wallet.localeCompare(b.wallet),
  );
}

/** The dividends and coupons received, per wrapper and year. */
export function dividendsByYear(
  events: readonly InvestmentEvent[],
): YearlyCash[] {
  return cashByYear(events, "dividend");
}

/** The fees paid, per wrapper and year. */
export function feesByYear(events: readonly InvestmentEvent[]): YearlyCash[] {
  return cashByYear(events, "fee");
}

export interface EventsSummary {
  gains: RealisedGain[];
  dividends: YearlyCash[];
  fees: YearlyCash[];
  /** The years anything happened in, newest first. */
  years: number[];
}

/** What the Analyse card says: the three figures, by wrapper and year. */
export function summariseEvents(
  events: readonly InvestmentEvent[],
): EventsSummary {
  const gains = realisedGains(events);
  const dividends = dividendsByYear(events);
  const fees = feesByYear(events);
  const years = [
    ...new Set([...gains, ...dividends, ...fees].map((row) => row.year)),
  ].sort((a, b) => b - a);
  return { gains, dividends, fees, years };
}

/* ------------------------------------------------- a broker's export */

type ColumnFamily =
  "date" | "label" | "name" | "isin" | "quantity" | "amount" | "price";

/** The words a column is known by, in either language, normalised. */
const COLUMN_WORDS: Record<ColumnFamily, readonly string[]> = {
  date: [
    "date",
    "date operation",
    "date d operation",
    "date de l operation",
    "trade date",
    "date execution",
    "date d execution",
    "date valeur",
  ],
  label: [
    "operation",
    "type",
    "type d operation",
    "libelle",
    "nature",
    "transaction type",
    "description",
    "detail",
    "mouvement",
    "sens",
    "action",
  ],
  name: [
    "valeur",
    "libelle valeur",
    "instrument",
    "produit",
    "product",
    "nom",
    "name",
    "security",
    "asset",
    "designation",
    "titre",
    "fonds",
    "fund",
    "support",
  ],
  isin: ["isin", "code isin", "code"],
  quantity: [
    "quantite",
    "qte",
    "quantity",
    "qty",
    "nombre",
    "nb titres",
    "nombre de titres",
    "nombre de parts",
    "parts",
    "units",
    "shares",
  ],
  amount: [
    "montant net",
    "net amount",
    "total net",
    "montant brut",
    "montant",
    "amount",
    "total",
    "net",
    "cash",
    "montant eur",
  ],
  price: [
    "cours",
    "prix",
    "price",
    "prix unitaire",
    "cours d execution",
    "cours execution",
    "unit price",
    "valeur liquidative",
  ],
};

/** The words a line's kind is known by, normalised; the first family that matches wins. */
const KIND_WORDS: readonly { kind: EventKind; words: readonly string[] }[] = [
  {
    kind: "dividend",
    words: [
      "dividende",
      "dividendes",
      "dividend",
      "dividends",
      "coupon",
      "coupons",
      "distribution",
      "interets",
      "interest",
    ],
  },
  {
    kind: "fee",
    words: [
      "frais",
      "fee",
      "fees",
      "commission",
      "commissions",
      "droits de garde",
      "custody",
      "taxe",
      "ttf",
      "tax",
      "courtage",
    ],
  },
  {
    kind: "sell",
    words: ["vente", "sell", "sale", "cession", "rachat", "redemption", "sold"],
  },
  {
    kind: "buy",
    words: [
      "achat",
      "buy",
      "purchase",
      "souscription",
      "subscription",
      "acquisition",
      "bought",
    ],
  },
];

type Columns = { date: number } & Record<
  Exclude<ColumnFamily, "date">,
  number | null
>;

/** The column a family names, among those not yet spoken for: an exact name first, then a name that contains the word. */
function findColumn(
  cells: readonly string[],
  family: ColumnFamily,
  taken: ReadonlySet<number>,
): number | null {
  // The longest matching word wins: « montant net » before « montant ».
  const words = [...COLUMN_WORDS[family]].sort((a, b) => b.length - a.length);
  const free = (index: number) => !taken.has(index);
  for (const word of words) {
    const exact = cells.findIndex(
      (cell, index) => free(index) && cell === word,
    );
    if (exact >= 0) {
      return exact;
    }
  }
  for (const word of words) {
    const inside = cells.findIndex(
      (cell, index) => free(index) && cell.includes(word),
    );
    if (inside >= 0) {
      return inside;
    }
  }
  return null;
}

function columnsFromHeader(header: readonly string[]): Columns | null {
  const cells = header.map((cell) => normalizeRuleWords(cell));
  const taken = new Set<number>();
  const next = (family: ColumnFamily): number | null => {
    const index = findColumn(cells, family, taken);
    if (index !== null) {
      taken.add(index);
    }
    return index;
  };
  const date = next("date");
  if (date === null) {
    return null;
  }
  const columns: Columns = {
    date,
    isin: next("isin"),
    quantity: next("quantity"),
    amount: next("amount"),
    price: next("price"),
    label: next("label"),
    name: next("name"),
  };
  // A date alone is a calendar: a header says what moved too.
  if (
    columns.amount === null &&
    (columns.quantity === null || columns.price === null)
  ) {
    return null;
  }
  return columns;
}

function kindOf(label: string): EventKind | null {
  const text = ` ${normalizeRuleWords(label)} `;
  for (const family of KIND_WORDS) {
    if (family.words.some((word) => text.includes(` ${word} `))) {
      return family.kind;
    }
  }
  return null;
}

/**
 * « 1 234,56 », « -254.30 », « (12) », « 12,30 € », « 1,234.56 » as a
 * signed number, or null. Comma and point together: the later one is the
 * decimal mark. One of them alone: a decimal mark, unless it comes several
 * times, which is a thousands mark.
 */
export function readBrokerNumber(cell: string | undefined): number | null {
  if (!cell) {
    return null;
  }
  const text = cell.replace(/[\s  ]/g, "");
  const negative = /^\(.*\)$/.test(text) || text.includes("-");
  const digits = text.replace(/[^0-9.,]/g, "");
  if (digits === "" || !/\d/.test(digits)) {
    return null;
  }
  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? digits.replace(/\./g, "").replace(",", ".")
        : digits.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized =
      digits.split(",").length > 2
        ? digits.replace(/,/g, "")
        : digits.replace(",", ".");
  } else {
    normalized =
      digits.split(".").length > 2 ? digits.replace(/\./g, "") : digits;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }
  return negative ? -value : value;
}

/** The ISIN inside a cell, when one is printed. */
const ISIN = /\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/;

export interface BrokerReading {
  events: ReadEvent[];
  /** Rows that looked like lines but could not be read as an event. */
  skipped: number;
  /**
   * Nothing to read: no header named a date and an amount (`columns`), or
   * the file holds no rows (`empty`).
   */
  problem: "columns" | "empty" | null;
}

/**
 * A broker's export, read as the events of one wallet. The header names
 * the columns; each line's kind comes from its words, else from the sign
 * of its amount beside a quantity; an amount missing but a price and a
 * quantity printed is their product. Lines of no kind — a transfer in, a
 * balance — are skipped and counted.
 */
export function readBrokerRows(
  rows: readonly (readonly string[])[],
  wallet: InvestmentWalletId,
): BrokerReading {
  const table = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (table.length === 0) {
    return { events: [], skipped: 0, problem: "empty" };
  }
  let headerAt = -1;
  let columns: Columns | null = null;
  for (let index = 0; index < Math.min(table.length, 12); index += 1) {
    const found = columnsFromHeader(table[index]!);
    if (found) {
      headerAt = index;
      columns = found;
      break;
    }
  }
  if (!columns) {
    return { events: [], skipped: 0, problem: "columns" };
  }
  const data = table.slice(headerAt + 1);
  const dateColumn = columns.date;
  const order = dateOrderOf(data.map((row) => row[dateColumn] ?? ""));

  const events: ReadEvent[] = [];
  const ranks = new Map<string, number>();
  let skipped = 0;
  for (const row of data) {
    const occurredOn = strictDate((row[dateColumn] ?? "").trim(), order);
    if (!occurredOn) {
      skipped += 1;
      continue;
    }
    const label =
      columns.label !== null ? (row[columns.label] ?? "").trim() : "";
    const name = columns.name !== null ? (row[columns.name] ?? "").trim() : "";
    const isinCell = columns.isin !== null ? (row[columns.isin] ?? "") : "";
    const isin =
      ISIN.exec(isinCell.toUpperCase())?.[1] ??
      ISIN.exec(`${name} ${label}`.toUpperCase())?.[1] ??
      null;
    const quantity =
      columns.quantity !== null
        ? readBrokerNumber(row[columns.quantity])
        : null;
    const price =
      columns.price !== null ? readBrokerNumber(row[columns.price]) : null;
    let amount =
      columns.amount !== null ? readBrokerNumber(row[columns.amount]) : null;
    if (amount === null && quantity !== null && price !== null) {
      amount = -(quantity * price);
    }
    let kind = kindOf(`${label} ${name}`);
    if (
      kind === null &&
      amount !== null &&
      quantity !== null &&
      quantity !== 0
    ) {
      // No word for it: a quantity sold is negative at some brokers, and
      // the cash of a buy is negative at all of them.
      kind = quantity < 0 || amount > 0 ? "sell" : "buy";
    }
    if (kind === null || amount === null || amount === 0) {
      skipped += 1;
      continue;
    }
    const absolute = roundMoney(Math.abs(amount));
    const identity = `${occurredOn}|${kind}|${absolute.toFixed(2)}|${
      isin ?? normalizeRuleWords(name || label)
    }`;
    const rank = ranks.get(identity) ?? 0;
    ranks.set(identity, rank + 1);
    events.push({
      wallet,
      kind,
      occurredOn,
      instrumentName: name || label || null,
      instrumentSymbol: null,
      isin,
      quantity:
        (kind === "buy" || kind === "sell") && quantity !== null
          ? Math.abs(quantity)
          : null,
      amount: absolute,
      note: label && label !== name ? label : null,
      fingerprint: `${identity}|${rank}`,
    });
  }
  return { events, skipped, problem: null };
}
