import type { SupabaseClient } from "@supabase/supabase-js";
import { buildApplyRecurringPlan } from "@finance/core/apply-recurring";
import { getCurrentMonth } from "@finance/core/constants";
import { quoteSource } from "@/lib/quote-source";
import {
  loadApplyRecurringData,
  refreshTemplateQuotes,
  writeReprices,
} from "@/lib/recurring-apply";
import type { Database } from "@finance/core/types/database";

type Client = SupabaseClient<Database>;

export interface RepriceRunOutcome {
  users: number;
  repriced: number;
  refreshed: number;
  failures: string[];
}

/**
 * The daily repricing walk, lifted out of its route.
 *
 * It shares a schedule with the bank sync now — both are the same job, which
 * is bringing the ledger up to date from somewhere outside it — so the work
 * lives here and the route is only the thing that says when.
 */
export async function repriceEveryUser(
  supabase: Client,
  today: string,
): Promise<RepriceRunOutcome> {
  const current = getCurrentMonth();
  const failures: string[] = [];

  // Only quote-priced templates can drift, so only their owners are worth
  // walking. A fixed amount changes when the user changes it, never on its
  // own.
  const { data: templateRows, error: templateError } = await supabase
    .from("recurring_templates")
    .select("user_id")
    .eq("active", true)
    .eq("pricing_type", "shares");

  if (templateError) {
    return { users: 0, repriced: 0, refreshed: 0, failures: [templateError.message] };
  }

  const userIds = new Set(
    (templateRows ?? []).map((row) => row.user_id as string),
  );

  if (userIds.size === 0) {
    return { users: 0, repriced: 0, refreshed: 0, failures };
  }

  // Which months anyone has applied into ahead of time. Nearest first:
  // PostgREST caps how many rows it will return, and if this ever truncates,
  // the months about to arrive are the ones that must not be dropped.
  const { data: aheadRows, error: aheadError } = await supabase
    .from("transactions")
    .select("user_id, occurred_on")
    .not("recurring_template_id", "is", null)
    .gte("occurred_on", today)
    .order("occurred_on", { ascending: true });

  if (aheadError) {
    return {
      users: userIds.size,
      repriced: 0,
      refreshed: 0,
      failures: [aheadError.message],
    };
  }

  const monthsByUser = new Map<string, Set<string>>();
  for (const row of aheadRows ?? []) {
    const userId = row.user_id as string;
    if (!userIds.has(userId)) {
      continue;
    }
    const months = monthsByUser.get(userId) ?? new Set<string>();
    months.add(String(row.occurred_on).slice(0, 7));
    monthsByUser.set(userId, months);
  }

  const currentKey = `${current.year}-${String(current.month).padStart(2, "0")}`;

  let repriced = 0;
  let refreshed = 0;

  for (const userId of userIds) {
    // The month in progress is always visited: it is where the templates get
    // read from, and where anything applied ahead almost always sits.
    const months = new Set(monthsByUser.get(userId) ?? []);
    months.add(currentKey);

    let quotesRefreshed = false;

    for (const monthKey of [...months].sort()) {
      const [year, month] = monthKey.split("-").map(Number);
      if (!year || !month) {
        continue;
      }

      try {
        const { templates, existingByKey, skippedKeys } =
          await loadApplyRecurringData(supabase, userId, year, month);

        if (!quotesRefreshed) {
          refreshed += await refreshTemplateQuotes(supabase, userId, templates);
          quotesRefreshed = true;
        }

        const plan = await buildApplyRecurringPlan(
          templates,
          existingByKey,
          year,
          month,
          { quotes: quoteSource, skippedKeys, today },
        );

        const result = await writeReprices(supabase, userId, plan.toReprice);
        repriced += result.repriced;
        failures.push(...result.failures);
      } catch (error) {
        // One user's bad month must not stop the rest of the run.
        failures.push(
          error instanceof Error ? error.message : "Unknown repricing failure",
        );
      }
    }
  }

  return { users: userIds.size, repriced, refreshed, failures };
}
