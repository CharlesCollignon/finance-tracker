import type { NextRequest } from "next/server";
import { resetDemo } from "@finance/data/demo";
import { isMissingSchemaOrFunction } from "@finance/data/schema";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The demo account, rebuilt for today (migration 081, `@finance/data/demo`):
 * nightly from Vercel's cron, and once from `scripts/seed-demo.mjs` after
 * the account is made. Reachable only with the cron secret; runs under the
 * service role, the only role the demo's tables let write.
 */

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

  const { data: demoId, error } = await supabase.rpc("demo_user_id");
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return Response.json({ skipped: "Migration 081 has not run here." });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!demoId) {
    return Response.json({
      skipped: "No demo account: run scripts/seed-demo.mjs first.",
    });
  }

  try {
    const counts = await resetDemo(supabase, demoId);
    return Response.json({ reset: demoId, ...counts });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error("[demo] reset failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
