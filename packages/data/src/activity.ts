import type { Db } from "./client";

/**
 * First-party audience measurement (migration 058): the signed-in user
 * opened the app today, and — when `event` is given — did one of the counted
 * things. The database keeps it under a salted hash of the account, with no
 * amount, shop or text, and writes nothing for someone who turned
 * « Mesure d'audience » off in Profile.
 *
 * Never in the way: a failure, or a database without migration 058, is
 * swallowed, because a count missed is nothing and a save that fails over
 * one is something.
 */
export type ActivityEvent = "add" | "close" | "afford";

export async function recordActivity(
  db: Db,
  event?: ActivityEvent,
): Promise<void> {
  try {
    await db.rpc("record_activity", event ? { event } : {});
  } catch {
    // A count missed.
  }
}
