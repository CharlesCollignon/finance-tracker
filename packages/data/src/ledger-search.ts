import {
  ilikeWords,
  searchNeedle,
  searchesEveryMonth,
} from "@finance/core/ledger-search";
import type { TransactionWithCategory } from "@finance/core/types/database";

import type { Db } from "./client";

/** How many rows a search across every month brings back at most. */
export const SEARCH_LIMIT = 100;

export interface LedgerSearch {
  /** Newest first. */
  rows: TransactionWithCategory[];
  /** Whether there were more than `SEARCH_LIMIT`. */
  more: boolean;
}

/**
 * The Journal's search, across every month: rows whose note — where a bank
 * puts the shop — or category name holds the words, or whose amount is the
 * one typed (`@finance/core/ledger-search`). Deleted rows stay out, as the
 * select policies keep them.
 */
export async function searchAllMonths(
  db: Db,
  userId: string,
  query: string,
): Promise<LedgerSearch> {
  const needle = searchNeedle(query);
  if (!needle || !searchesEveryMonth(needle)) {
    return { rows: [], more: false };
  }

  const words = ilikeWords(needle.text);
  const conditions: string[] = [];
  if (words.length >= 2) {
    conditions.push(`note.ilike.*${words}*`);
    // A category's name, through the ids of the ones that hold the words:
    // PostgREST's `or` cannot reach into an embedded table.
    const { data: categories, error } = await db
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", `%${words}%`);
    if (error) {
      throw error;
    }
    if (categories && categories.length > 0) {
      conditions.push(
        `category_id.in.(${categories.map((category) => category.id).join(",")})`,
      );
    }
  }
  if (needle.amount !== null) {
    conditions.push(`amount.eq.${needle.amount}`);
  }
  if (conditions.length === 0) {
    return { rows: [], more: false };
  }

  const { data, error } = await db
    .from("transactions")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("user_id", userId)
    .or(conditions.join(","))
    .order("occurred_on", { ascending: false })
    .order("id")
    .limit(SEARCH_LIMIT + 1);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as TransactionWithCategory[];
  return {
    rows: rows.slice(0, SEARCH_LIMIT),
    more: rows.length > SEARCH_LIMIT,
  };
}
