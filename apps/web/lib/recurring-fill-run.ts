import type { SupabaseClient } from "@supabase/supabase-js";
import { fillDue, isBankFed } from "@/lib/recurring-apply";
import type { Database } from "@finance/core/types/database";

type Client = SupabaseClient<Database>;

export interface FillRunOutcome {
  users: number;
  created: number;
  failures: string[];
}

/**
 * The daily walk that writes every charge whose day has come, for everyone
 * with one, so that the morning's rows are already there when the app is
 * opened.
 *
 * The app does the same on opening, which is what makes this a convenience
 * rather than a dependency: a deployment without the service role, or a day
 * the run fails, only means the rows arrive a second after the page does.
 *
 * Bank-fed users are passed over. For them the bank is the record of what
 * happened and a template only forecasts, so nothing writes from it.
 */
export async function fillEveryUser(
  supabase: Client,
  today: string,
): Promise<FillRunOutcome> {
  const failures: string[] = [];

  const { data: templateRows, error } = await supabase
    .from("recurring_templates")
    .select("user_id")
    .eq("active", true);

  if (error) {
    return { users: 0, created: 0, failures: [error.message] };
  }

  const userIds = new Set(
    (templateRows ?? []).map((row) => row.user_id as string),
  );

  let created = 0;

  for (const userId of userIds) {
    try {
      if (await isBankFed(supabase, userId)) {
        continue;
      }

      const result = await fillDue(supabase, userId, today);
      created += result.created;
      failures.push(...result.failures);
    } catch (runError) {
      // One user's bad month must not stop the rest of the run.
      failures.push(
        runError instanceof Error ? runError.message : "Unknown fill failure",
      );
    }
  }

  return { users: userIds.size, created, failures };
}
