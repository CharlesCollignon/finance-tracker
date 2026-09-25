/**
 * Tags as the Plan page manages them: each with how many transactions carry it.
 *
 * The count is PostgREST's embedded count,
 * `tags.select("id, name, transaction_tags(count)")`, which runs under the
 * caller's RLS. A transaction in the bin (036) is not counted, and that is the
 * number the delete confirmation should state: the transactions the owner can
 * see.
 */
import type { Tag } from "./types/database";

export type TagUsage = Pick<Tag, "id" | "name"> & {
  /** Transactions carrying the tag, not counting any in the bin. */
  uses: number;
};

/** One row of `tags.select("id, name, transaction_tags(count)")`. */
type TagUsageRow = Pick<Tag, "id" | "name"> & {
  transaction_tags: { count: number }[];
};

export function tagUsageFromRows(rows: readonly TagUsageRow[]): TagUsage[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    uses: row.transaction_tags[0]?.count ?? 0,
  }));
}

/**
 * The other tag a rename would collide with, if any, so the app can offer to
 * merge into it instead of failing.
 *
 * Exact after trimming, as `unique (user_id, name)` in 012 is: "Holiday" and
 * "holiday" are two tags to the database, so they are two here. The tag being
 * renamed never clashes with itself, which is what lets a rename change only
 * the case.
 */
export function findRenameConflict(
  tags: readonly TagUsage[],
  tagId: string,
  name: string,
): TagUsage | null {
  const wanted = name.trim();
  return tags.find((tag) => tag.id !== tagId && tag.name === wanted) ?? null;
}
