import type { NextRequest } from "next/server";
import { isMissingSchemaOrFunction } from "@finance/data/schema";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The nightly sweep: deletes for good what was deleted and not taken back.
 *
 * A transaction or a category deleted is only marked (migration 036), so the
 * toast's Undo has something to restore. A month is long enough to cover "I
 * deleted that last week by mistake" and short enough that the tables do not
 * carry a year of rows nobody can see. The deletes are ordinary ones, so
 * every cascade fires as it would have on the day.
 *
 * Reachable only with the cron secret; runs under the service role, the only
 * role allowed to call `sweep_deleted`.
 */

const RETENTION_DAYS = 30;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return Response.json({ skipped: "SUPABASE_SERVICE_ROLE_KEY is not set." });
  }

  const before = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase.rpc("sweep_deleted", { before });

  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return Response.json({ skipped: "Migration 036 has not run here." });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ swept: data ?? 0 });
}
