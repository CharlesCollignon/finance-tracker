import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@finance/core/types/database";

/**
 * The client every function in this package is handed.
 *
 * `@finance/data` is the reads and writes both apps make against the same
 * tables, written once. Neither app's client is created here: the web passes
 * its request's cookie client (or the service role, in a cron), the phone its
 * own singleton — whose fetch announces each write to the screens that read
 * it. A function that reached for a client of its own would be one the cron
 * could not run under the service role, and one the phone's screens could not
 * hear.
 *
 * Every query filters on `user_id` as well as relying on row level security,
 * so the same call is right under either.
 */
export type Db = SupabaseClient<Database>;
