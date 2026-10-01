/**
 * What the review decided recently, a decision at a time.
 *
 * The review files a whole shop with one answer, so taking that answer back
 * has to be one press too: twenty-three rows of "Carrefour · Courses", each
 * with its own Undo, would turn a slip of the thumb into a chore. Rows are
 * gathered the way the inbox gathered them — direction and the coarse
 * merchant key (`bankMerchantKey`) — and further by what became of them, so
 * a group is exactly the rows one decision would have produced: filed under
 * the same category, or left out.
 *
 * Newest decision first, by the latest date in each group. Kept free of
 * database concerns so the rules are testable on their own.
 */

import { bankMerchantKey } from "./bank-merchant";

/** One decided row, as much of it as grouping needs. */
export interface DecidedFeedItem {
  id: string;
  occurredOn: string;
  amount: number;
  direction: "in" | "out";
  counterparty: string | null;
  note: string;
  status: "imported" | "ignored";
  /** Where it landed; null when it was left out or its entry is gone. */
  categoryId: string | null;
}

export interface DecidedFeedGroup<Item extends DecidedFeedItem> {
  key: string;
  /** The description its rows share most often. */
  name: string;
  direction: "in" | "out";
  status: "imported" | "ignored";
  categoryId: string | null;
  /** Newest first. */
  rows: Item[];
  count: number;
  total: number;
  lastOn: string;
}

function describe(item: DecidedFeedItem): string {
  return item.counterparty?.trim() || item.note;
}

export function groupDecidedFeed<Item extends DecidedFeedItem>(
  items: readonly Item[],
): DecidedFeedGroup<Item>[] {
  const byKey = new Map<string, Item[]>();
  for (const item of items) {
    const merchant = bankMerchantKey(describe(item));
    const key = [
      item.direction,
      item.status,
      item.categoryId ?? "-",
      merchant || `row:${item.id}`,
    ].join(":");
    const rows = byKey.get(key) ?? [];
    rows.push(item);
    byKey.set(key, rows);
  }

  const groups: DecidedFeedGroup<Item>[] = [];
  for (const [key, rows] of byKey) {
    const sorted = [...rows].sort((a, b) =>
      b.occurredOn.localeCompare(a.occurredOn),
    );
    const names = new Map<string, number>();
    for (const row of sorted) {
      const name = describe(row);
      names.set(name, (names.get(name) ?? 0) + 1);
    }
    const name = [...names.entries()].reduce((best, entry) =>
      entry[1] > best[1] ? entry : best,
    )[0];
    const first = sorted[0]!;
    groups.push({
      key,
      name,
      direction: first.direction,
      status: first.status,
      categoryId: first.categoryId,
      rows: sorted,
      count: sorted.length,
      total:
        Math.round(sorted.reduce((sum, row) => sum + row.amount, 0) * 100) /
        100,
      lastOn: first.occurredOn,
    });
  }

  return groups.sort(
    (a, b) =>
      b.lastOn.localeCompare(a.lastOn) ||
      b.count - a.count ||
      a.name.localeCompare(b.name),
  );
}
