import type { NextRequest } from "next/server";
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
  bankAttention,
  bankAttentionNotification,
} from "@finance/core/bank-attention";
import {
  formatShortDate,
  getCurrentMonth,
  todayIsoLocal,
} from "@finance/core/constants";
import type {
  Category,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { readLocales } from "@/lib/push/locale";
import { DEFAULT_LOCALE, type Locale } from "@finance/core/i18n/locale";
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
 * it cannot know that the bank delivered the salary overnight or that a
 * connection is about to stop. Those are the things this run says, and the
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

/** What this one user should hear about today. */
async function notificationsFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  monthKey: string,
  locale: Locale,
): Promise<PendingNotification[]> {
  const [year, month] = monthKey.split("-").map(Number);

  const [categories, templates, alreadySent] = await Promise.all([
    supabase.from("categories").select("*").eq("user_id", userId),
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

  const categoryRows = (categories.data ?? []) as Category[];
  const templateRows = (templates.data ??
    []) as RecurringTemplateWithCategory[];

  // Ahead of the digest: a feed about to stop is the one thing here that
  // gets worse by waiting, and it applies to people with no templates at all.
  const bank = await bankNotificationFor(supabase, userId, today, locale);
  const lead = bank ? [bank] : [];

  // Nothing else to say to someone with no templates.
  if (templateRows.length === 0) {
    return lead;
  }

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

  const digest = buildDueNotifications({
    today,
    arrivedCharges,
    alreadySent: new Set(
      ((alreadySent.data ?? []) as { key: string }[]).map((row) => row.key),
    ),
    pendingRecurring: templateRows.length,
    // Stored per user precisely so that this line can be right: there is no
    // browser in a cron request to ask.
    t: translator(locale),
  });
  return [...lead, ...digest];
}

/**
 * The reminder a connected bank earns today, if it has not been sent.
 *
 * Asked apart from the month's log read above, which only fetches keys that
 * mention the month: a consent key names the day it ends, which is as often
 * next month as this one.
 */
async function bankNotificationFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  locale: Locale,
): Promise<PendingNotification | null> {
  const { data: connection } = await supabase
    .from("bank_connections")
    .select("status, consent_valid_until, last_synced_at, connected_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection) {
    return null;
  }
  const notification = bankAttentionNotification(
    bankAttention(connection, today),
    {
      since: connection.last_synced_at ?? connection.connected_at,
      formatDate: (isoDate) => formatShortDate(isoDate, locale),
      t: translator(locale),
    },
  );
  if (!notification) {
    return null;
  }
  const { data: sent } = await supabase
    .from("notification_log")
    .select("key")
    .eq("user_id", userId)
    .eq("key", notification.key)
    .maybeSingle();
  return sent ? null : notification;
}
