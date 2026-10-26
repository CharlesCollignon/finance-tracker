import { merchantWords } from "./bank-merchant";
import { getMonthBounds, shiftMonth } from "./constants";
import { monthShort } from "./i18n/calendar-names";
import type { Locale } from "./i18n/locale";
import { normalizeMerchant } from "./merchant-memory";
import type { CategoryType, TransactionWithCategory } from "./types/database";

/**
 * « Par commerce »: every place the money went over the last twelve months,
 * one card a shop — for both apps.
 *
 * The Journal's search finds a shop's rows; the by-category view says what
 * a category did. Neither answers the question a shop raises on its own:
 * how often, how much a time, what it comes to in a normal month, when
 * last. The merchant memory already keys rows by shop for the filing; this
 * groups them the same way and says those four things, and nothing more —
 * a fact about what was recorded, never a judgement on it.
 *
 * Nothing here queries: `@finance/data/merchant-screen` gathers the window's
 * rows and hands them in.
 */

/** How far back the screen reads and draws. */
export const MERCHANT_MONTHS = 12;

/** How many of a shop's rows a card lists before « +N ». */
export const MERCHANT_ROWS_SHOWN = 12;

export interface MerchantMonthPoint {
  /** YYYY-MM. */
  monthKey: string;
  /** "Oct", for an axis with no room. */
  shortLabel: string;
  total: number;
  /** Nothing recorded at this shop that month. */
  empty: boolean;
}

export interface MerchantRow {
  id: string;
  occurredOn: string;
  amount: number;
  note: string | null;
  categoryName: string;
}

export interface MerchantCard {
  /** Stable across renders: the shop as the matcher keys it. */
  key: string;
  /** The shop as it is written most often. */
  name: string;
  /** The category its rows are filed under most. */
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  categoryIcon: string | null;
  /** Filed under more than one category over the window. */
  mixed: boolean;
  visits: number;
  /** Over the window. */
  total: number;
  /** What a non-empty month comes to: the median, not the mean. */
  normal: number;
  perVisit: number;
  lastOn: string;
  lastAmount: number;
  /** Oldest first, one a month. */
  points: MerchantMonthPoint[];
  /** Newest first. */
  rows: MerchantRow[];
}

export interface MerchantScreen {
  /** Biggest first. */
  merchants: MerchantCard[];
  /** The window, ISO. */
  from: string;
  to: string;
}

/** The shortest key that can name a shop on its own. */
const MIN_KEY = 3;

/**
 * The shop a row is grouped under: the first two words that mean something
 * once the card noise, the articles and the company forms a bank staples
 * on are dropped (`merchantWords`) — so « CARREFOUR MARKET PARIS 11 » and
 * « CARREFOUR MARKET LYON » are one shop, and « Boulangerie Dupont » stays
 * apart from « Boulangerie Martin ». Finer than the matcher's key, which
 * stops at one word to file more lines unasked: here nothing is filed, and
 * a shop told apart from its neighbour is the point. Else the note as
 * typed, normalised; else nothing — a row with no words is no shop.
 */
export function merchantKeyOf(note: string | null | undefined): string {
  const words = merchantWords(note).slice(0, 2).join(" ");
  if (words.length >= MIN_KEY) {
    return words;
  }
  const plain = normalizeMerchant(note);
  return plain.length >= MIN_KEY ? plain : "";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The middle value, or the mean of the two middle ones; 0 of nothing. */
function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** The most frequent value, the earliest seen winning a tie. */
function mostCommon(values: readonly string[]): string {
  const counts = new Map<string, number>();
  let best = values[0] ?? "";
  let bestCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** The months of the window, oldest first. */
export function merchantWindow(
  year: number,
  month: number,
  locale: Locale,
): { keys: { monthKey: string; shortLabel: string }[]; from: string; to: string } {
  const keys = Array.from({ length: MERCHANT_MONTHS }, (_, index) => {
    const at = shiftMonth(year, month, index - (MERCHANT_MONTHS - 1));
    return {
      monthKey: `${at.year}-${String(at.month).padStart(2, "0")}`,
      shortLabel: monthShort(at.month, locale),
    };
  });
  const first = shiftMonth(year, month, -(MERCHANT_MONTHS - 1));
  return {
    keys,
    from: getMonthBounds(first.year, first.month).start,
    to: getMonthBounds(year, month).end,
  };
}

/**
 * The screen, from the window's rows. A row inside a wallet — a DCA bought
 * at the broker — is not a shop; neither is a row with no words.
 */
export function buildMerchantScreen(
  rows: readonly TransactionWithCategory[],
  { year, month, locale }: { year: number; month: number; locale: Locale },
): MerchantScreen {
  const window = merchantWindow(year, month, locale);
  const groups = new Map<string, TransactionWithCategory[]>();

  for (const row of rows) {
    if (
      row.categories.type === "investment" &&
      row.categories.counts_toward_summary === false
    ) {
      continue;
    }
    const key = merchantKeyOf(row.note);
    if (key === "") {
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const merchants: MerchantCard[] = [];
  for (const [key, group] of groups) {
    const newestFirst = [...group].sort(
      (a, b) =>
        b.occurred_on.localeCompare(a.occurred_on) || b.id.localeCompare(a.id),
    );
    const byMonth = new Map<string, number>();
    for (const row of group) {
      const monthKey = row.occurred_on.slice(0, 7);
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + Number(row.amount));
    }
    const points = window.keys.map(({ monthKey, shortLabel }) => {
      const total = byMonth.get(monthKey);
      return {
        monthKey,
        shortLabel,
        total: roundMoney(total ?? 0),
        empty: total === undefined,
      };
    });
    const total = roundMoney(
      group.reduce((sum, row) => sum + Number(row.amount), 0),
    );
    const categoryId = mostCommon(group.map((row) => row.category_id));
    const leader =
      group.find((row) => row.category_id === categoryId) ?? newestFirst[0]!;
    const newest = newestFirst[0]!;

    merchants.push({
      key,
      name:
        mostCommon(
          group.map((row) => row.note?.trim() ?? "").filter((note) => note),
        ) || key,
      categoryId,
      categoryName: leader.categories.name,
      categoryType: leader.categories.type,
      categoryIcon: leader.categories.icon ?? null,
      mixed: new Set(group.map((row) => row.category_id)).size > 1,
      visits: group.length,
      total,
      normal: roundMoney(
        median(points.filter((point) => !point.empty).map((point) => point.total)),
      ),
      perVisit: roundMoney(total / group.length),
      lastOn: newest.occurred_on,
      lastAmount: Number(newest.amount),
      points,
      rows: newestFirst.map((row) => ({
        id: row.id,
        occurredOn: row.occurred_on,
        amount: Number(row.amount),
        note: row.note,
        categoryName: row.categories.name,
      })),
    });
  }

  merchants.sort(
    (a, b) => b.total - a.total || b.visits - a.visits || a.key.localeCompare(b.key),
  );

  return { merchants, from: window.from, to: window.to };
}

/**
 * The cards a query finds: the shop's name, its key or its category, the
 * words normalised as the key is so « café » finds « CAFE JOYEUX ».
 */
export function filterMerchants(
  merchants: readonly MerchantCard[],
  query: string,
): MerchantCard[] {
  const needle = normalizeMerchant(query);
  if (needle === "") {
    return [...merchants];
  }
  return merchants.filter(
    (card) =>
      card.key.includes(needle) ||
      normalizeMerchant(card.name).includes(needle) ||
      normalizeMerchant(card.categoryName).includes(needle),
  );
}
