"use server";

import {
  searchAllMonths,
  type LedgerSearch,
} from "@finance/data/ledger-search";
import { getOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";

/**
 * The Journal's search across every month (`searchAllMonths`), over the
 * owner on screen: the person's rows, or their space's.
 */
export async function searchEveryMonth(query: string): Promise<LedgerSearch> {
  const owner = await getOwner();
  if (!owner || typeof query !== "string" || query.length > 200) {
    return { rows: [], more: false };
  }
  return searchAllMonths(await createClient(), owner.ownerId, query);
}
