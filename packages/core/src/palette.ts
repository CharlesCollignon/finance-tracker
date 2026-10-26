import { parseTypedAmount } from "./amount-input";
import { normalizeRuleWords } from "./filing-rules";
import { CALENDAR_NAMES } from "./i18n/calendar-names";
import { LOCALES, type Locale } from "./i18n/locale";

/**
 * « Palette »: what Cmd+K offers, worked out from what was typed.
 *
 * The sheet Cmd+K opened held the add and a way to Questions. A palette
 * holds those first, then every page, and — once something is typed — what
 * the words name: an amount to add, a month to open, a shop, a charge, a
 * category. Pure: the client hands in its pages with their labels in the
 * reader's language and the owner's shops, charges and categories, and
 * draws what comes back.
 */

export type PaletteItem =
  | { kind: "add"; amount: number | null }
  | { kind: "addCharge" }
  | { kind: "ask" }
  | { kind: "page"; href: string; label: string }
  | { kind: "month"; year: number; month: number; target: "ledger" | "bearing" }
  | { kind: "shop"; key: string; label: string }
  | { kind: "charge"; id: string; name: string }
  | { kind: "category"; id: string; name: string };

export interface PaletteSource {
  /** Every page the reader may go to, labelled in their language. */
  pages: readonly { href: string; label: string }[];
  categories: readonly { id: string; name: string }[];
  /** The shops the ledger knows, keyed as the merchant memory keys them. */
  shops: readonly { key: string; label: string }[];
  charges: readonly { id: string; name: string }[];
}

/** How many of each kind a query lists at most. */
const PER_KIND = 5;

/** A stable id for a list and its keyboard. */
export function paletteItemId(item: PaletteItem): string {
  switch (item.kind) {
    case "add":
      return item.amount === null ? "add" : `add:${item.amount}`;
    case "addCharge":
    case "ask":
      return item.kind;
    case "page":
      return `page:${item.href}`;
    case "month":
      return `month:${item.target}:${item.year}-${item.month}`;
    case "shop":
      return `shop:${item.key}`;
    case "charge":
      return `charge:${item.id}`;
    case "category":
      return `category:${item.id}`;
  }
}

/**
 * The month some words name, in either language — « octobre », « oct »,
 * « oct 2025 », « 2025-10 », « 10/2025 » — or null. A month with no year
 * is the most recent one not after today.
 */
export function parseMonthQuery(
  query: string,
  today: string,
): { year: number; month: number } | null {
  const text = normalizeRuleWords(query);
  if (text === "") {
    return null;
  }
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));

  const iso = /^(\d{4})[- /](\d{1,2})$/.exec(text);
  if (iso) {
    const month = Number(iso[2]);
    return month >= 1 && month <= 12 ? { year: Number(iso[1]), month } : null;
  }
  const french = /^(\d{1,2})[- /](\d{4})$/.exec(text);
  if (french) {
    const month = Number(french[1]);
    return month >= 1 && month <= 12 ? { year: Number(french[2]), month } : null;
  }

  const words = text.split(" ");
  const yearWord = words.find((word) => /^\d{4}$/.test(word));
  const nameWords = words.filter((word) => !/^\d+$/.test(word));
  if (nameWords.length !== 1 || words.length > 2) {
    return null;
  }
  const name = nameWords[0]!;
  let month: number | null = null;
  for (const locale of LOCALES) {
    const names = CALENDAR_NAMES[locale];
    for (let index = 0; index < 12; index += 1) {
      const long = normalizeRuleWords(names.monthLong[index] ?? "");
      const short = normalizeRuleWords(names.monthShort[index] ?? "");
      if (
        name.length >= 3 &&
        (long === name || long.startsWith(name) || short === name)
      ) {
        month = index + 1;
        break;
      }
    }
    if (month !== null) {
      break;
    }
  }
  if (month === null) {
    return null;
  }
  if (yearWord) {
    return { year: Number(yearWord), month };
  }
  return { year: month > thisMonth ? thisYear - 1 : thisYear, month };
}

function matches(needle: string, text: string): "start" | "inside" | null {
  const haystack = normalizeRuleWords(text);
  if (haystack.startsWith(needle)) {
    return "start";
  }
  if (haystack.includes(needle)) {
    return "inside";
  }
  return null;
}

/** The best few of a kind: what starts with the words first, then what holds them. */
function pick<T>(
  rows: readonly T[],
  needle: string,
  text: (row: T) => string,
): T[] {
  const starts: T[] = [];
  const inside: T[] = [];
  for (const row of rows) {
    const found = matches(needle, text(row));
    if (found === "start") {
      starts.push(row);
    } else if (found === "inside") {
      inside.push(row);
    }
  }
  return [...starts, ...inside].slice(0, PER_KIND);
}

export function buildPaletteItems(
  query: string,
  source: PaletteSource,
  { today }: { today: string; locale: Locale },
): PaletteItem[] {
  const trimmed = query.trim();
  if (trimmed === "") {
    return [
      { kind: "add", amount: null },
      { kind: "addCharge" },
      { kind: "ask" },
      ...source.pages.map(
        (page): PaletteItem => ({ kind: "page", href: page.href, label: page.label }),
      ),
    ];
  }

  const items: PaletteItem[] = [];
  const amount = parseTypedAmount(trimmed);
  if (amount !== null && amount > 0 && /^[\d\s.,]+$/.test(trimmed)) {
    items.push({ kind: "add", amount });
  }
  const month = parseMonthQuery(trimmed, today);
  if (month) {
    items.push({ kind: "month", ...month, target: "ledger" });
    items.push({ kind: "month", ...month, target: "bearing" });
  }

  const needle = normalizeRuleWords(trimmed);
  if (needle !== "") {
    for (const page of pick(source.pages, needle, (page) => page.label)) {
      items.push({ kind: "page", href: page.href, label: page.label });
    }
    for (const category of pick(source.categories, needle, (row) => row.name)) {
      items.push({ kind: "category", id: category.id, name: category.name });
    }
    for (const shop of pick(source.shops, needle, (row) => row.label)) {
      items.push({ kind: "shop", key: shop.key, label: shop.label });
    }
    for (const charge of pick(source.charges, needle, (row) => row.name)) {
      items.push({ kind: "charge", id: charge.id, name: charge.name });
    }
  }
  return items;
}
