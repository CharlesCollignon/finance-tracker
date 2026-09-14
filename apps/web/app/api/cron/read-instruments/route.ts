import type { NextRequest } from "next/server";

import { instrumentReadingConfigured } from "@/lib/instrument-reading/client";
import { readInstrumentsForEveryUser } from "@/lib/instrument-reading/run";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Keeping instrument readings current, unattended.
 *
 * Its own schedule rather than a step inside `/api/cron/refresh`, for the
 * reason that route states about its own two jobs: sharing a request does not
 * mean sharing a fate. A search-backed reading takes tens of seconds, and
 * bolting one onto a run that already reprices every user's templates and
 * reads a bank statement would be the thing that runs the function out of
 * time — taking the statement down with it.
 *
 * Fails closed on the secret, as the other cron routes do: a missing
 * `CRON_SECRET` is a 401, never an open endpoint.
 */

export const maxDuration = 60;
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
    // No service role key: the same 200-with-a-reason the other cron routes
    // give, because a deployment without one is configured that way on
    // purpose rather than broken.
    return Response.json({ skipped: "no service role key" });
  }

  if (!instrumentReadingConfigured()) {
    return Response.json({ skipped: "no model key" });
  }

  try {
    const outcome = await readInstrumentsForEveryUser(supabase);
    return Response.json(outcome);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Reading run failed",
      },
      { status: 502 },
    );
  }
}
