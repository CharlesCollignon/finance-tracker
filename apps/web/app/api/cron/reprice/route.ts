import type { NextRequest } from "next/server";
import { buildApplyRecurringPlan } from "@finance/core/apply-recurring";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { quoteSource } from "@/lib/quote-source";
import {
  loadApplyRecurringData,
  refreshTemplateQuotes,
  writeReprices,
} from "@/lib/recurring-apply";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The daily repricing run.
 *
 * A share-priced occurrence applied in advance is a forecast: the amount is
 * whatever the instrument cost the day it was written down, and it drifts
 * from the day after. Nobody should have to press a button for that, so this
 * job walks the occurrences still dated ahead and brings them back in line —
 * and refreshes each template's stored price, which is what projections read
 * and what an occurrence falls back to when the market is unreachable.
 *
 * It only ever touches occurrences the plan classifies as repricing: derived
 * from a quote, already applied, and not yet arrived. It never creates a
 * transaction and never rewrites one whose date has passed — what you paid
 * on the 3rd is not the market's business on the 20th. Filling a new month
 * in stays the user's move.
 *
 * Runs under the service role, so it sees every user. It is reachable only
 * with the cron secret.
 */

// One quote per instrument is cached for the whole run, but the walk is still
// sequential and network-bound; the default 10s is not enough.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // A missing secret fails closed: an unprotected endpoint that writes to
  // every user's ledger is worse than one that never runs.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    // Without the service role key the run cannot see other users' data, and
    // silently repricing nobody would look identical to a healthy run.
    return Response.json(
      { skipped: "SUPABASE_SERVICE_ROLE_KEY is not set." },
      { status: 200 },
    );
  }

  const today = todayIsoLocal();
  const current = getCurrentMonth();

  // Only quote-priced templates can drift, so only their owners are worth
  // walking. A fixed amount changes when the user changes it, never on its
  // own.
  const { data: templateRows, error: templateError } = await supabase
    .from("recurring_templates")
    .select("user_id")
    .eq("active", true)
    .eq("pricing_type", "shares");

  if (templateError) {
    return Response.json({ error: templateError.message }, { status: 500 });
  }

  const userIds = new Set(
    (templateRows ?? []).map((row) => row.user_id as string),
  );

  if (userIds.size === 0) {
    return Response.json({ users: 0, repriced: 0, refreshed: 0 });
  }

  // Which months anyone has applied into ahead of time. Usually just the one
  // in progress, but a month can be filled in early, and its occurrences
  // deserve the same treatment.
  // Nearest first: PostgREST caps how many rows it will return, and if this
  // ever truncates, the months about to arrive are the ones that must not be
  // the rows dropped. A month further out gets its turn on a later run.
  const { data: aheadRows, error: aheadError } = await supabase
    .from("transactions")
    .select("user_id, occurred_on")
    .not("recurring_template_id", "is", null)
    .gte("occurred_on", today)
    .order("occurred_on", { ascending: true });

  if (aheadError) {
    return Response.json({ error: aheadError.message }, { status: 500 });
  }

  const monthsByUser = new Map<string, Set<string>>();
  for (const row of aheadRows ?? []) {
    const userId = row.user_id as string;
    if (!userIds.has(userId)) {
      continue;
    }
    const monthKey = String(row.occurred_on).slice(0, 7);
    const months = monthsByUser.get(userId) ?? new Set<string>();
    months.add(monthKey);
    monthsByUser.set(userId, months);
  }

  const currentKey = `${current.year}-${String(current.month).padStart(2, "0")}`;

  let repriced = 0;
  let refreshed = 0;
  const failures: string[] = [];

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

  return Response.json({
    users: userIds.size,
    repriced,
    refreshed,
    ...(failures.length > 0 ? { failures: failures.slice(0, 5) } : {}),
  });
}
