import type { NextRequest } from "next/server";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { countFulfilmentProposals } from "@/lib/queries/fulfilment";
import {
  buildDueNotifications,
  type PendingNotification,
} from "@finance/core/push-digest";
import {
  configureWebPush,
  fanOut,
  readDevices,
  type UserDevices,
} from "@/lib/push/send";
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
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@finance/core/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";

/**
 * The daily notification run.
 *
 * What counts as worth saying lives in `@finance/core/push-digest`, which is
 * tested; how to reach a device lives in `lib/push/send`. This file is what
 * is left: who to ask about, and what to log.
 *
 * It used to say, here, that "mobile schedules its reminders on the device;
 * the web cannot" — and so only browsers were sent to. Half right. The phone
 * can schedule a reminder, because a reminder is something it already knows;
 * it cannot know that a cap was breached overnight or that the bank left six
 * entries needing a category. Those are the things this run says, and the
 * phone was the one place they were never said. It now gets them too.
 *
 * Runs under the service role, so it sees every user. It is reachable only
 * with the cron secret.
 */

// Sending is sequential and network-bound; the default 10s is not enough.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // A missing secret fails closed: an unprotected endpoint that notifies
  // every user is worse than one that never runs.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Not a reason to stop. Web Push needs VAPID keys this deployment may not
  // have; Expo needs none, so a run with no keys can still reach every phone
  // and only skips the browsers.
  const webPushReady = configureWebPush();

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

  // Only users who asked to hear from us are worth querying for — a browser
  // that granted permission, a phone that registered a token, or both.
  const byUser = await readDevices(supabase);

  // One query for everybody's language, rather than one per user inside the
  // loop below. This is the query the whole `user_preferences` table exists
  // for: there is no browser in a cron request and no session either, so the
  // row is the only place the reader's language can come from.
  const localeByUser = await readLocales(supabase, [...byUser.keys()]);

  const queue: { devices: UserDevices; notification: PendingNotification }[] =
    [];
  const logged: { user_id: string; key: string }[] = [];

  for (const [userId, devices] of byUser) {
    const due = await notificationsFor(
      supabase,
      userId,
      today,
      monthKey,
      localeByUser.get(userId) ?? DEFAULT_LOCALE,
    );
    for (const notification of due) {
      logged.push({ user_id: userId, key: notification.key });
      queue.push({ devices, notification });
    }
  }

  // Written before sending, not after. A duplicate notification is a worse
  // outcome than a missed one, and a crash mid-send would otherwise repeat
  // everything tomorrow. One row per user rather than per device, which is
  // what makes "said once" mean once across a laptop and a phone.
  if (logged.length > 0) {
    await supabase.from("notification_log").upsert(logged, {
      onConflict: "user_id,key",
      ignoreDuplicates: true,
    });
  }

  let sent = 0;
  let removed = 0;

  for (const item of queue) {
    const result = await fanOut(
      supabase,
      item.devices,
      item.notification,
      webPushReady,
    );
    sent += result.sent;
    removed += result.removed;
  }

  return Response.json({
    users: byUser.size,
    sent,
    removed,
    ...(webPushReady
      ? {}
      : { note: "Web Push is not configured; phones only." }),
  });
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * What language each of these users reads in.
 *
 * Users with no row are simply absent from the map and fall back to the
 * default, which is the right reading of an absent row: it means nobody has
 * ever chosen, not that they chose English.
 */
async function readLocales(
  supabase: AdminClient,
  userIds: string[],
): Promise<Map<string, Locale>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data } = await supabase
    .from("user_preferences")
    .select("user_id, locale")
    .in("user_id", userIds);

  const byUser = new Map<string, Locale>();
  for (const row of (data ?? []) as { user_id: string; locale: string }[]) {
    const locale = parseLocale(row.locale);
    if (locale) {
      byUser.set(row.user_id, locale);
    }
  }
  return byUser;
}

/** What this one user should hear about today. */
async function notificationsFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  monthKey: string,
  locale: Locale,
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
  const templateRows = (templates.data ??
    []) as RecurringTemplateWithCategory[];

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
    locale,
  );

  // Asked here rather than in `buildDueNotifications`, which is deliberately
  // free of database concerns. A failure is not worth losing the rest of the
  // digest over: the Month page asks the same question on every visit.
  let arrivedCharges = 0;
  try {
    arrivedCharges = await countFulfilmentProposals(
      userId,
      templateRows,
      categoryRows,
      year!,
      month!,
      supabase,
    );
  } catch {
    arrivedCharges = 0;
  }

  return buildDueNotifications({
    today,
    budgetProgress: progress,
    arrivedCharges,
    alreadySent: new Set(
      ((alreadySent.data ?? []) as { key: string }[]).map((row) => row.key),
    ),
    pendingRecurring: templateRows.length,
    // The cron has no access to a browser's currency preference, and EUR is
    // the app's default; a notification is not the place to get precious
    // about a display setting. The language is a different matter — it is
    // stored per user precisely so that this line can be right.
    formatAmount: (amount: number) => formatCurrency(amount, "EUR", locale),
    t: translator(locale),
  });
}
