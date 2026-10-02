import type { NextRequest } from "next/server";
import * as properties from "@finance/data/properties";
import { isMissingSchema } from "@finance/data/schema";
import {
  fetchPriceIndex,
  readPropertyMarket,
} from "@/lib/property-market/read";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The weekly market cron: the price index as INSEE publishes it, then the
 * market readings that have aged — a month old, or missing — read again,
 * stalest first, within one budget. DVF gains a half-year twice a year and
 * INSEE a quarter four times, so a week is soon enough for both.
 *
 * Reachable only with the cron secret; runs under the service role, the only
 * role allowed to write the index.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BUDGET_MS = 45_000;
const STALE_DAYS = 30;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) {
    return Response.json({ skipped: "SUPABASE_SERVICE_ROLE_KEY is not set." });
  }
  const started = Date.now();

  const index = await fetchPriceIndex().catch(() => []);
  const saved =
    index.length > 0 ? await properties.savePriceIndex(admin, index) : null;
  if (saved?.error) {
    return Response.json({ error: saved.error }, { status: 500 });
  }

  const { data: homes, error } = await admin
    .from("properties")
    .select("id, user_id, property_market_readings(read_at)")
    .neq("kind", "other")
    .not("citycode", "is", null);
  if (error) {
    if (isMissingSchema(error)) {
      return Response.json({ skipped: "Migration 050 has not run here." });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  const stale = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  const due = (homes ?? [])
    .map((home) => {
      const reading = Array.isArray(home.property_market_readings)
        ? home.property_market_readings[0]
        : home.property_market_readings;
      return { ...home, readAt: reading ? Date.parse(reading.read_at) : 0 };
    })
    .filter((home) => home.readAt < stale)
    .sort((a, b) => a.readAt - b.readAt);

  const outcomes: Record<string, number> = {};
  for (const home of due) {
    if (Date.now() - started > BUDGET_MS) {
      break;
    }
    const outcome = await readPropertyMarket(
      admin,
      home.user_id,
      home.id,
    ).catch(() => "failed" as const);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return Response.json({ index: index.length, due: due.length, ...outcomes });
}
