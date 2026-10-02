import type { Db } from "@finance/data/client";
import * as moved from "@finance/data/moved-rows";
import type { TransactionWithCategory } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

/**
 * Rows whose money moved in a range but that count for another day —
 * `@finance/data/moved-rows`, with the request's client by default.
 */
export async function getMovedBetween(
  userId: string,
  from: string,
  to: string,
  client?: Db,
): Promise<TransactionWithCategory[]> {
  return moved.getMovedBetween(
    client ?? (await createClient()),
    userId,
    from,
    to,
  );
}
