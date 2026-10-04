import "server-only";

import { cache } from "react";
import { flagsFromRows, NO_FLAGS, type FlagSet } from "@finance/core/flags";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";
import { createClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

/**
 * The feature flags on for this request's account, asked of the database once.
 *
 * `evaluated_feature_flags()` (migration 039) does the evaluating, so the
 * phone gets the same answer from the same function. Wrapped in `cache()` for
 * the same reason `getAuthUser` is: a page and every component under it ask
 * once per request.
 *
 * Anything short of an answer reads as every flag off: signed out, the
 * migration not yet run, a fault. A flag's off side is the app as it was.
 */
export const getFlags = cache(async (): Promise<FlagSet> =>
  flagsFor(await createClient()),
);

/**
 * The flags as the database answers them for whoever `client` acts as — the
 * request's cookie session, or the phone's bearer in a route.
 */
export async function flagsFor(client: Client): Promise<FlagSet> {
  const { data, error } = await client.rpc("evaluated_feature_flags");
  if (error) {
    // PGRST202 / 42883: no such function, which is migration 039 not run.
    // Expected until it is, so not worth a line in the logs.
    if (error.code !== "PGRST202" && error.code !== "42883") {
      console.error("Failed to read feature flags", error);
    }
    return NO_FLAGS;
  }
  return flagsFromRows(data);
}
