import type { NextRequest } from "next/server";
import webpush from "web-push";
import { todayIsoLocal } from "@finance/core/constants";
import { isGoneStatus } from "@finance/core/push-digest";
import type { PushSubscriptionRow } from "@finance/core/types/database";
import { bankFeedOwnerId } from "@/lib/bank/client";
import { autoCloseMonths } from "@/lib/bank/auto-close";
import { syncBankFeed, type SyncOutcome } from "@/lib/bank/sync";
import { repriceEveryUser } from "@/lib/recurring-reprice-run";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The refresh: everything that brings the ledger up to date from somewhere
 * outside it.
 *
 * Two jobs share this route. Repricing corrects share-priced occurrences that
 * are applied but not yet due, so a DCA written in advance carries the price
 * it will actually cost rather than the one it cost when it was written. The
 * bank sync asks the bank for anything new and files what it says.
 *
 * They run several times a day, from several schedules pointed at this one
 * path. Hobby allows a hundred cron jobs but insists each runs at most once a
 * day, so four daily entries at four different hours is the legal way to be
 * current four times a day — and four is also exactly what PSD2 allows an
 * account information service to read an account without the user present.
 * The two ceilings agreeing is a coincidence, but a convenient one.
 *
 * Only the first run of the day does the expensive half. Repricing walks
 * every user's templates and quotes each against the market; doing that four
 * times would quadruple the load on the quote source to correct prices that
 * move on a scale of days. The statement is the thing worth re-reading, so
 * the later runs read only that.
 *
 * Sharing a request does not mean sharing a fate. They talk to different
 * third parties and fail independently, so each is wrapped: an unreachable
 * bank must not stop quotes being refreshed, and a rate-limited quote source
 * must not stop the statement being read.
 */

// Network-bound throughout: two walks back to back on the full run, one on
// the bank-only runs — which is part of why the split is worth having, since
// it gives the bank fetch the whole budget three times a day. Sixty seconds
// is also the ceiling a Hobby function gets, so this is the most that can be
// asked for.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface StepFailure {
  step: "reprice" | "bank";
  message: string;
}

/**
 * The schedule that does the whole job, quotes included.
 *
 * Vercel sends the firing schedule as a header, which is the only thing
 * distinguishing one entry from another when they all point at the same path.
 * A missing or unrecognised header means do everything: a hand-run curl and a
 * single-schedule deployment should both get the full job, and a schedule
 * renamed in `vercel.json` without this constant being updated should degrade
 * to repricing too often rather than never.
 */
const FULL_RUN_SCHEDULE = "0 7 * * *";

function isFullRun(request: NextRequest): boolean {
  const schedule = request.headers.get("x-vercel-cron-schedule");
  return schedule === null || schedule === FULL_RUN_SCHEDULE;
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
  const full = isFullRun(request);

  // --- quotes ------------------------------------------------------------

  let reprice: { users: number; repriced: number; refreshed: number } | null =
    null;
  if (full) {
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
  }

  // --- the bank ----------------------------------------------------------

  const ownerId = bankFeedOwnerId();
  let bank: SyncOutcome | null = null;

  let monthsClosed = 0;

  if (ownerId) {
    try {
      // Unattended: nobody is watching, so this spends from the four-a-day
      // allowance. When it is spent the sync still runs and reads the stored
      // statement, which is what every run did before pulling existed.
      bank = await syncBankFeed(supabase, ownerId, { pull: "unattended" });
      // Straight after the statement is filed, because that is when the
      // balance a close needs has just arrived. Closing is arithmetic on
      // rows this run has already stored, so it costs no network call and
      // cannot be the thing that runs the function out of time.
      const closes = await autoCloseMonths(supabase, ownerId);
      monthsClosed = closes.closed.length;
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
    run: full ? "full" : "bank-only",
    reprice,
    bank: bank ? { ...bank, notified } : null,
    monthsClosed,
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
