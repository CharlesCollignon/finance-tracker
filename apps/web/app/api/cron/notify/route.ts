import type { NextRequest } from "next/server";
import webpush from "web-push";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import {
  buildDueNotifications,
  isGoneStatus,
  type PendingNotification,
} from "@finance/core/push-digest";
import {
  formatCurrency,
  getCurrentMonth,
  getMonthBounds,
  todayIsoLocal,
} from "@finance/core/constants";
import { buildMonthlySummary } from "@finance/core/monthly-summary";
import type {
  Budget,
  Category,
  PushSubscriptionRow,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@finance/core/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The daily notification run.
 *
 * Mobile schedules its reminders on the device; the web cannot, so a server
 * has to decide each morning whether there is anything worth saying. What
 * counts as worth saying lives in `@finance/core/push-digest`, which is
 * tested; this file is the plumbing around it — who to ask about, how to
 * send, and what to do with a subscription that has died.
 *
 * Runs under the service role, so it sees every user. It is reachable only
 * with the cron secret.
 */

// Sending is sequential and network-bound; the default 10s is not enough.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface Sendable {
  subscription: PushSubscriptionRow;
  notification: PendingNotification;
}

function configureWebPush(): string | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return "Push is not configured on this deployment.";
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return null;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // A missing secret fails closed: an unprotected endpoint that notifies
  // every user is worse than one that never runs.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const misconfigured = configureWebPush();
  if (misconfigured) {
    return Response.json({ skipped: misconfigured }, { status: 200 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    // Without the service role key the run cannot see other users' data, and
    // silently notifying nobody would look identical to a healthy run.
    return Response.json(
      { skipped: "SUPABASE_SERVICE_ROLE_KEY is not set." },
      { status: 200 },
    );
  }

  const today = todayIsoLocal();
  const { year, month } = getCurrentMonth();
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (subError) {
    return Response.json({ error: subError.message }, { status: 500 });
  }

  // Only users who asked to hear from us are worth querying for.
  const byUser = new Map<string, PushSubscriptionRow[]>();
  for (const row of (subscriptions ?? []) as PushSubscriptionRow[]) {
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
  }

  const queue: Sendable[] = [];
  const logged: { user_id: string; key: string }[] = [];

  for (const [userId, rows] of byUser) {
    const due = await notificationsFor(supabase, userId, today, monthKey);
    for (const notification of due) {
      logged.push({ user_id: userId, key: notification.key });
      for (const subscription of rows) {
        queue.push({ subscription, notification });
      }
    }
  }

  // Written before sending, not after. A duplicate notification is a worse
  // outcome than a missed one, and a crash mid-send would otherwise repeat
  // everything tomorrow.
  if (logged.length > 0) {
    await supabase.from("notification_log").upsert(logged, {
      onConflict: "user_id,key",
      ignoreDuplicates: true,
    });
  }

  let sent = 0;
  let removed = 0;

  for (const item of queue) {
    try {
      await webpush.sendNotification(
        {
          endpoint: item.subscription.endpoint,
          keys: {
            p256dh: item.subscription.p256dh,
            auth: item.subscription.auth,
          },
        },
        JSON.stringify(item.notification),
      );
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 0;
      if (isGoneStatus(status)) {
        // The browser is gone for good; keeping the row means failing
        // forever. Anything else is transient and the row stays.
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", item.subscription.endpoint);
        removed += 1;
      }
    }
  }

  return Response.json({ users: byUser.size, sent, removed });
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/** What this one user should hear about today. */
async function notificationsFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  monthKey: string,
): Promise<PendingNotification[]> {
  const [year, month] = monthKey.split("-").map(Number);
  const { start, end } = getMonthBounds(year!, month!);

  const [budgets, categories, transactions, templates, alreadySent] =
    await Promise.all([
      supabase.from("budgets").select("*").eq("user_id", userId),
      supabase.from("categories").select("*").eq("user_id", userId),
      supabase
        .from("transactions")
        .select("*, categories(name, type, icon, counts_toward_summary)")
        .eq("user_id", userId)
        .gte("occurred_on", start)
        .lte("occurred_on", end),
      supabase
        .from("recurring_templates")
        .select("*, categories(name, type, icon, counts_toward_summary)")
        .eq("user_id", userId)
        .eq("active", true),
      supabase
        .from("notification_log")
        .select("key")
        .eq("user_id", userId)
        .like("key", `%${monthKey}%`),
    ]);

  const budgetRows = (budgets.data ?? []) as Budget[];
  const categoryRows = (categories.data ?? []) as Category[];
  const templateRows = (templates.data ?? []) as RecurringTemplateWithCategory[];

  // Nothing to say to someone with no caps and no templates.
  if (budgetRows.length === 0 && templateRows.length === 0) {
    return [];
  }

  const summary = buildMonthlySummary(
    (transactions.data ?? []) as TransactionWithCategory[],
    templateRows,
    year!,
    month!,
    "current",
  );

  const progress = buildBudgetProgress(
    budgetRows,
    summary.expenseBreakdown,
    summary.expenses,
    new Map(categoryRows.map((row) => [row.id, row.name] as const)),
  );

  return buildDueNotifications({
    today,
    budgetProgress: progress,
    alreadySent: new Set(
      ((alreadySent.data ?? []) as { key: string }[]).map((row) => row.key),
    ),
    pendingRecurring: templateRows.length,
    // The cron has no access to a browser's currency preference, and EUR is
    // the app's default; a notification is not the place to get precious
    // about a display setting.
    formatAmount: (amount: number) => formatCurrency(amount, "EUR"),
  });
}
