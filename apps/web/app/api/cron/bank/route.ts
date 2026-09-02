import type { NextRequest } from "next/server";
import webpush from "web-push";
import { todayIsoLocal } from "@finance/core/constants";
import { isGoneStatus } from "@finance/core/push-digest";
import type { PushSubscriptionRow } from "@finance/core/types/database";
import { bankFeedOwnerId } from "@/lib/bank/client";
import { syncBankFeed } from "@/lib/bank/sync";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The daily bank sync.
 *
 * Most of what a bank reports the app can already file — the merchant is one
 * the user has answered for before — so running this unattended is the whole
 * point: the ledger fills itself in and the user hears nothing. They are told
 * only when the run left something that genuinely needs a decision, because a
 * notification that arrives whether or not anything happened teaches people
 * to ignore notifications.
 *
 * Wired to the single-user path, so it syncs exactly one account: whoever the
 * credentials belong to. Under Partner Connect this becomes a loop over
 * everyone who has connected a bank, and nothing else here changes.
 */

// Paging a statement and pricing nothing is quick, but it is still several
// round trips to a third party.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = bankFeedOwnerId();
  if (!userId) {
    return Response.json({ skipped: "No bank feed is configured." });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return Response.json({ skipped: "SUPABASE_SERVICE_ROLE_KEY is not set." });
  }

  let outcome;
  try {
    outcome = await syncBankFeed(supabase, userId);
  } catch (error) {
    // A bank that cannot be reached today is an ordinary outcome, not an
    // incident; tomorrow's run picks up everything this one missed.
    return Response.json({
      error: error instanceof Error ? error.message : "Sync failed",
    });
  }

  if (outcome.pending === 0) {
    return Response.json({ ...outcome, notified: 0 });
  }

  // Keyed by the day so a run that finds nothing new says nothing, and one
  // that does says it once.
  const key = `bank-review:${todayIsoLocal()}`;
  const { data: already } = await supabase
    .from("notification_log")
    .select("key")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();

  if (already || !configureWebPush()) {
    return Response.json({ ...outcome, notified: 0 });
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  const rows = (subscriptions ?? []) as PushSubscriptionRow[];
  if (rows.length === 0) {
    return Response.json({ ...outcome, notified: 0 });
  }

  // Written before sending: a duplicate notification is a worse outcome than
  // a missed one, and a crash mid-send would otherwise repeat it tomorrow.
  await supabase
    .from("notification_log")
    .upsert(
      { user_id: userId, key },
      { onConflict: "user_id,key", ignoreDuplicates: true },
    );

  const payload = JSON.stringify({
    key,
    title: "From your bank",
    body:
      outcome.pending === 1
        ? "One entry needs a category."
        : `${outcome.pending} entries need a category.`,
    url: "/transactions",
  });

  let notified = 0;
  let removed = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
      );
      notified += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 0;
      if (isGoneStatus(status)) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", row.endpoint);
        removed += 1;
      }
    }
  }

  return Response.json({ ...outcome, notified, removed });
}
