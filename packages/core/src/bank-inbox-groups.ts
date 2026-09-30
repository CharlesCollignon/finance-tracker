/**
 * The review inbox, one shop at a time.
 *
 * A first sync reaches back over the whole statement, and what it cannot
 * file on its own can be hundreds of rows. Deciding them one by one is the
 * chore the inbox exists to shrink, and it is also the wrong unit: a habit
 * belongs to a shop, not to a Tuesday. So the rows are grouped by the same
 * coarse merchant key the matcher already files on (`bankMerchantKey`), and
 * one answer settles every row in a group — which also teaches the matcher
 * that shop once, for next time.
 *
 * A group is one direction of money. The same merchant can pay in (a refund)
 * and be paid (a purchase), and those are two different questions, so they
 * are two groups. A row whose description leaves no usable key is a group of
 * one, rather than being thrown in with every other unreadable line.
 *
 * Sorted by how much of the pile a group clears — its row count times its
 * total — so the first few answers do most of the work.
 *
 * Kept free of database concerns so the rules are testable on their own.
 */

import { bankMerchantKey, type BankMerchantIndex } from "./bank-merchant";
import type { CategoryType } from "./types/database";

/** One waiting row, as much of it as grouping needs. */
export interface FeedGroupItem {
  id: string;
  occurredOn: string;
  amount: number;
  direction: "in" | "out";
  counterparty: string | null;
  note: string;
  /** What the sync would have filed it under, when it had an opinion. */
  suggestedCategoryId?: string | null;
}

/** The categories a suggestion is checked against. */
export interface FeedGroupCategory {
  id: string;
  type: CategoryType;
  archived?: boolean;
}

export interface FeedGroup<Item extends FeedGroupItem = FeedGroupItem> {
  /** Stable across renders: direction and merchant key, or the row for a one-off. */
  key: string;
  /** What to call the group: the description its rows share most often. */
  name: string;
  direction: "in" | "out";
  /** Newest first. */
  rows: Item[];
  count: number;
  total: number;
  firstOn: string;
  lastOn: string;
  /** The category one press would file the whole group under, if any. */
  suggestedCategoryId: string | null;
  /**
   * The user's own history files this shop more than one way (the Amazon
   * case), or its rows disagree among themselves. One answer for all of them
   * would be a guess, so the group asks row by row instead.
   */
  mixed: boolean;
}

export interface GroupPendingFeedOptions {
  /** The user's history, keyed the way the matcher keys it. */
  bankMerchants: BankMerchantIndex;
  categories: readonly FeedGroupCategory[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The description to name a row by: the counterparty when the bank gave one. */
function describe(item: FeedGroupItem): string {
  return item.counterparty?.trim() || item.note;
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

export function groupPendingFeed<Item extends FeedGroupItem>(
  items: readonly Item[],
  { bankMerchants, categories }: GroupPendingFeedOptions,
): FeedGroup<Item>[] {
  const usable = new Map(
    categories
      .filter((category) => !category.archived)
      .map((category) => [category.id, category.type]),
  );

  /**
   * Whether a category can answer for money going this way. Money in is only
   * ever income here: the matcher never infers income from a merchant, and a
   * refund filed under an expense category would count as spending.
   */
  function fits(
    categoryId: string | null | undefined,
    direction: "in" | "out",
  ) {
    if (!categoryId) {
      return false;
    }
    const type = usable.get(categoryId);
    if (!type) {
      return false;
    }
    return direction === "in" ? type === "income" : type !== "income";
  }

  const byKey = new Map<string, { merchantKey: string; rows: Item[] }>();
  for (const item of items) {
    const merchantKey = bankMerchantKey(describe(item));
    const key = merchantKey
      ? `${item.direction}:${merchantKey}`
      : `${item.direction}:row:${item.id}`;
    const entry = byKey.get(key) ?? { merchantKey, rows: [] };
    entry.rows.push(item);
    byKey.set(key, entry);
  }

  const groups: FeedGroup<Item>[] = [];
  for (const [key, { merchantKey, rows }] of byKey) {
    const direction = rows[0]!.direction;
    const sorted = [...rows].sort((a, b) =>
      b.occurredOn.localeCompare(a.occurredOn),
    );

    const rule = merchantKey ? bankMerchants.get(merchantKey) : undefined;
    const ownSuggestions = new Set(
      rows
        .map((row) => row.suggestedCategoryId)
        .filter((id): id is string => fits(id, direction)),
    );

    let suggestedCategoryId: string | null = null;
    if (rule && fits(rule.categoryId, direction)) {
      suggestedCategoryId = rule.categoryId;
    } else if (ownSuggestions.size === 1) {
      suggestedCategoryId = [...ownSuggestions][0]!;
    }

    const dates = rows.map((row) => row.occurredOn).sort();
    groups.push({
      key,
      name: mostCommon(sorted.map(describe)),
      direction,
      rows: sorted,
      count: rows.length,
      total: roundMoney(rows.reduce((sum, row) => sum + row.amount, 0)),
      firstOn: dates[0]!,
      lastOn: dates[dates.length - 1]!,
      suggestedCategoryId,
      mixed:
        rows.length > 1 &&
        ((rule !== undefined && !rule.unanimous) || ownSuggestions.size > 1),
    });
  }

  return groups.sort(
    (a, b) =>
      b.count * b.total - a.count * a.total ||
      b.lastOn.localeCompare(a.lastOn) ||
      a.name.localeCompare(b.name),
  );
}
