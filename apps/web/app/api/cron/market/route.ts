import type { NextRequest } from "next/server";
import { translator } from "@finance/core/i18n/t";
import type { PendingNotification } from "@finance/core/push-digest";
import { marketMomentNotification } from "@finance/core/push-messages";
import {
  defaultRecipient,
  readRecipients,
} from "@finance/data/preferences";
import * as properties from "@finance/data/properties";
import { isMissingSchema } from "@finance/data/schema";
import {
  fetchPriceIndex,
  readPropertyMarket,
} from "@/lib/property-market/read";
import { deliver } from "@/lib/push/deliver";
import { configureWebPush } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The weekly market cron: the price index as INSEE publishes it, then the
 * market readings that have aged — a month old, or missing — read again,
 * stalest first, within one budget. DVF gains a half-year twice a year and
 * INSEE a quarter four times, so a week is soon enough for both.
 *
 * A home whose reading now reaches a half-year of sales the last one did not
 * is told its new estimate (`property` notifications): at most twice a year,
 * since the record of sales grows twice a year. Run after 08:00 in Paris, so
 * the push is not held by the quiet hours and then lost — the next reading
 * would no longer be new.
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

  const recipients = await readRecipients(admin, [
    ...new Set(due.map((home) => home.user_id)),
  ]);
  const news = new Map<string, PendingNotification[]>();

  const outcomes: Record<string, number> = {};
  for (const home of due) {
    if (Date.now() - started > BUDGET_MS) {
      break;
    }
    const { locale } = recipients.get(home.user_id) ?? defaultRecipient();
    const outcome = await readPropertyMarket(admin, home.user_id, home.id, {
      onNewEstimate: async (estimate) => {
        news.set(home.user_id, [
          ...(news.get(home.user_id) ?? []),
          marketMomentNotification({
            ...estimate,
            t: translator(locale),
            locale,
          }),
        ]);
      },
    }).catch(() => "failed" as const);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }

  const webPushReady = configureWebPush();
  let told = 0;
  for (const [userId, notifications] of news) {
    const delivery = await deliver(
      admin,
      userId,
      recipients.get(userId) ?? defaultRecipient(),
      notifications,
      { webPushReady },
    );
    told += delivery.sent;
  }

  return Response.json({
    index: index.length,
    due: due.length,
    ...outcomes,
    estimates: [...news.values()].flat().length,
    told,
  });
}
