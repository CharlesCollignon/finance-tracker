import type { NextRequest } from "next/server";
import webpush from "web-push";
import { todayIsoLocal } from "@finance/core/constants";
import { isGoneStatus } from "@finance/core/push-digest";
import type { PushSubscriptionRow } from "@finance/core/types/database";
import { bankFeedOwnerId } from "@/lib/bank/client";
import { syncBankFeed, type SyncOutcome } from "@/lib/bank/sync";
import { repriceEveryUser } from "@/lib/recurring-reprice-run";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The morning refresh: everything that brings the ledger up to date from
 * somewhere outside it.
 *
 * Two jobs share this schedule. Repricing corrects share-priced occurrences
 * that are applied but not yet due, so a DCA written in advance carries the
 * price it will actually cost rather than the one it cost when it was
 * written. The bank sync files what the account has seen since yesterday.
 * Both are the same shape of work — reconcile with an outside source, under
 * the service role, before the digest at eight decides what is worth saying —
 * and they run together because Vercel's Hobby plan allows two cron jobs and
 * the notification run has to be one of them.
 *
 * Sharing a request does not mean sharing a fate. They talk to different
 * third parties and fail independently, so each is wrapped: an unreachable
 * bank must not stop quotes being refreshed, and a rate-limited quote source
 * must not stop the statement being read.
 */

// Two network-bound walks back to back. Sixty seconds is also the ceiling a
// Hobby function gets, so this is the most that can be asked for.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface StepFailure {
  step: "reprice" | "bank";
  message: string;
}

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

  const supabase = createAdminClient();
  if (!supabase) {
    // Without the service role key the run cannot see other users' data, and
    // silently doing nothing would look identical to a healthy run.
    return Response.json({ skipped: "SUPABASE_SERVICE_ROLE_KEY is not set." });
  }

  const today = todayIsoLocal();
  const failures: StepFailure[] = [];

  // --- quotes ------------------------------------------------------------

  let reprice = { users: 0, repriced: 0, refreshed: 0 };
  try {
    const outcome = await repriceEveryUser(supabase, today);
    reprice = {
      users: outcome.users,
      repriced: outcome.repriced,
      refreshed: outcome.refreshed,
    };
    for (const message of outcome.failures.slice(0, 3)) {
      failures.push({ step: "reprice", message });
    }
  } catch (error) {
    failures.push({
      step: "reprice",
      message: error instanceof Error ? error.message : "Repricing failed",
    });
  }

  // --- the bank ----------------------------------------------------------

  const ownerId = bankFeedOwnerId();
  let bank: SyncOutcome | null = null;

  if (ownerId) {
    try {
      bank = await syncBankFeed(supabase, ownerId);
    } catch (error) {
      // A bank that cannot be reached today is an ordinary outcome, not an
      // incident; tomorrow's run picks up everything this one missed.
      failures.push({
        step: "bank",
        message: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }

  const notified =
    bank && ownerId && bank.pending > 0
      ? await notifyPendingReview(supabase, ownerId, bank.pending, today)
      : 0;

  return Response.json({
    reprice,
    bank: bank ? { ...bank, notified } : null,
    ...(failures.length > 0 ? { failures } : {}),
  });
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Say that something needs a category, once.
 *
 * Keyed by the day, so a run that finds nothing new says nothing and one that
 * does says it a single time. A notification that arrives whether or not
 * anything happened is how people learn to ignore notifications.
 */
async function notifyPendingReview(
  supabase: AdminClient,
  userId: string,
  pending: number,
  today: string,
): Promise<number> {
  const key = `bank-review:${today}`;

  const { data: already } = await supabase
    .from("notification_log")
    .select("key")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();

  if (already || !configureWebPush()) {
    return 0;
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  const rows = (subscriptions ?? []) as PushSubscriptionRow[];
  if (rows.length === 0) {
    return 0;
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
      pending === 1
        ? "One entry needs a category."
        : `${pending} entries need a category.`,
    url: "/transactions",
  });

  let notified = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
      );
      notified += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 0;
      if (isGoneStatus(status)) {
        // The browser is gone for good; keeping the row means failing forever.
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", row.endpoint);
      }
    }
  }

  return notified;
}
