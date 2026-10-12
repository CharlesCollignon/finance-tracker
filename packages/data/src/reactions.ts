import type { ActionResult } from "@finance/core/action-result";
import type { ReactionKind, ReactionTally } from "@finance/core/reactions";

import type { Db } from "./client";
import { dbError } from "./errors";
import { isMissingSchema } from "./schema";

/**
 * Reactions and votes (migration 070), for both apps: everyone's counts,
 * through `reaction_counts`, which hands out numbers and no user id, and
 * the reader's own rows. A database behind 070 reads as nobody having said
 * anything, and refuses to be told.
 */

export async function readReactions(
  db: Db,
  targets: readonly string[],
  userId: string | null,
): Promise<Map<string, ReactionTally>> {
  const tallies = new Map<string, ReactionTally>();
  if (targets.length === 0) {
    return tallies;
  }
  const [counts, mine] = await Promise.all([
    db.rpc("reaction_counts", { targets: [...targets] }),
    userId
      ? db
          .from("reactions")
          .select("target, kind")
          .eq("user_id", userId)
          .in("target", [...targets])
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [counts, mine]) {
    if (result.error) {
      if (isMissingSchema(result.error)) {
        return tallies;
      }
      throw result.error;
    }
  }
  const tally = (target: string) =>
    tallies.get(target) ?? { counts: {}, mine: [] };
  for (const row of counts.data ?? []) {
    const current = tally(row.target);
    tallies.set(row.target, {
      ...current,
      counts: { ...current.counts, [row.kind]: Number(row.count) },
    });
  }
  for (const row of mine.data ?? []) {
    const current = tally(row.target);
    tallies.set(row.target, {
      ...current,
      mine: [...current.mine, row.kind as ReactionKind],
    });
  }
  return tallies;
}

/**
 * Say (`on`) or take back one reaction. Saying it twice, or taking back
 * what was never said, is a success: the row is as asked either way.
 */
export async function setReaction(
  db: Db,
  userId: string,
  target: string,
  kind: ReactionKind,
  on: boolean,
): Promise<ActionResult> {
  const { error } = on
    ? await db.from("reactions").insert({ target, user_id: userId, kind })
    : await db
        .from("reactions")
        .delete()
        .eq("target", target)
        .eq("user_id", userId)
        .eq("kind", kind);
  if (!error || error.code === "23505") {
    return { success: true };
  }
  if (error.message?.includes("rate_limited")) {
    return { error: "errors.tooManyAttempts" };
  }
  return { error: dbError(error) };
}
