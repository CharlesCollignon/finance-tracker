"use server";

import {
  searchAllMonths,
  type LedgerSearch,
} from "@finance/data/ledger-search";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

/** The Journal's search across every month (`searchAllMonths`). */
export async function searchEveryMonth(query: string): Promise<LedgerSearch> {
  const user = await getAuthUser();
  if (!user || typeof query !== "string" || query.length > 200) {
    return { rows: [], more: false };
  }
  return searchAllMonths(await createClient(), user.id, query);
}
