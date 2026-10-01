import { getMovedBetween as movedBetween } from "@finance/data/moved-rows";
import type { TransactionWithCategory } from "@finance/core/types/database";

import { supabase } from "@/lib/supabase";

/**
 * Rows whose money moved in a range but that count for another day —
 * `@finance/data/moved-rows`, with the phone's client.
 */
export function getMovedBetween(
  userId: string,
  from: string,
  to: string,
): Promise<TransactionWithCategory[]> {
  return movedBetween(supabase, userId, from, to);
}
