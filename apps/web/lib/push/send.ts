import webpush from "web-push";
import { isGoneStatus } from "@finance/core/push-digest";
import type { PendingNotification } from "@finance/core/push-digest";
import type {
  ExpoPushTokenRow,
  PushSubscriptionRow,
} from "@finance/core/types/database";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Getting one notification to every device a user has.
 *
 * There are two kinds and they have nothing in common but the message. A
 * browser is reached through the Web Push protocol, with VAPID keys this
 * deployment holds and a payload encrypted to keys the browser generated. A
 * phone is reached by handing Expo a token and letting it talk to APNs or
 * FCM. Neither is a fallback for the other: a user may well have both, and
 * both should buzz.
 *
 * Gathered here because two cron routes send — the daily digest and the bank
 * sync — and until now each did its own fan-out to browsers only. Adding
 * phones in two places would have been two places to forget.
 *
 * Everything is best-effort. A notification is the least important thing
 * either route does, and neither should fail because a push service had a bad
 * afternoon.
 */

/** Expo takes up to a hundred messages per request. */
const EXPO_BATCH = 100;

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";

export interface FanOutResult {
  /** Devices that took the message. */
  sent: number;
  /** Rows deleted because the device is gone for good. */
  removed: number;
}

/**
 * Whether Web Push can be used at all, and configures it if so.
 *
 * Phones need no such setup — Expo's send endpoint is unauthenticated for
 * ordinary sends — so a deployment with no VAPID keys can still notify the
 * app even though it cannot notify a browser.
 */
export function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

/** Everywhere one user can be reached. */
export interface UserDevices {
  browsers: PushSubscriptionRow[];
  phones: ExpoPushTokenRow[];
}

/** Reads both device tables once, grouped by user. */
export async function readDevices(
  supabase: AdminClient,
): Promise<Map<string, UserDevices>> {
  const [{ data: subscriptions }, { data: tokens }] = await Promise.all([
    supabase.from("push_subscriptions").select("*"),
    supabase.from("expo_push_tokens").select("*"),
  ]);

  const byUser = new Map<string, UserDevices>();

  function slot(userId: string): UserDevices {
    const existing = byUser.get(userId);
    if (existing) {
      return existing;
    }
    const fresh: UserDevices = { browsers: [], phones: [] };
    byUser.set(userId, fresh);
    return fresh;
  }

  for (const row of (subscriptions ?? []) as PushSubscriptionRow[]) {
    slot(row.user_id).browsers.push(row);
  }
  for (const row of (tokens ?? []) as ExpoPushTokenRow[]) {
    slot(row.user_id).phones.push(row);
  }

  return byUser;
}

/** Reads the devices of exactly one user. */
export async function readDevicesFor(
  supabase: AdminClient,
  userId: string,
): Promise<UserDevices> {
  const [{ data: subscriptions }, { data: tokens }] = await Promise.all([
    supabase.from("push_subscriptions").select("*").eq("user_id", userId),
    supabase.from("expo_push_tokens").select("*").eq("user_id", userId),
  ]);

  return {
    browsers: (subscriptions ?? []) as PushSubscriptionRow[],
    phones: (tokens ?? []) as ExpoPushTokenRow[],
  };
}

async function sendToBrowsers(
  supabase: AdminClient,
  rows: readonly PushSubscriptionRow[],
  notification: PendingNotification,
): Promise<FanOutResult> {
  let sent = 0;
  let removed = 0;
  const payload = JSON.stringify(notification);

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
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
          .eq("endpoint", row.endpoint);
        removed += 1;
      }
    }
  }

  return { sent, removed };
}

interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

async function sendToPhones(
  supabase: AdminClient,
  rows: readonly ExpoPushTokenRow[],
  notification: PendingNotification,
): Promise<FanOutResult> {
  let sent = 0;
  let removed = 0;

  for (let start = 0; start < rows.length; start += EXPO_BATCH) {
    const batch = rows.slice(start, start + EXPO_BATCH);

    try {
      const response = await fetch(EXPO_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(
          batch.map((row) => ({
            to: row.token,
            title: notification.title,
            body: notification.body,
            sound: "default",
            // The channel the app creates when notifications are switched
            // on. Android drops a message naming a channel that does not
            // exist, so this has to match `CHANNEL_ID` in the app.
            channelId: "reminders",
            // Where tapping it should land. A web path, translated to a
            // mobile route by `lib/notification-routing` in the app — the
            // digest is written once for both, so it speaks one vocabulary.
            data: { key: notification.key, url: notification.url },
          })),
        ),
      });

      if (!response.ok) {
        continue;
      }

      const body = (await response.json().catch(() => null)) as {
        data?: ExpoTicket[];
      } | null;
      const tickets = body?.data ?? [];

      for (const [index, ticket] of tickets.entries()) {
        if (ticket.status === "ok") {
          sent += 1;
          continue;
        }
        // The one permanent failure. Everything else — a rate limit, a bad
        // afternoon at APNs — is transient, and deleting the row for it
        // would silence a working phone forever.
        if (ticket.details?.error === "DeviceNotRegistered") {
          const row = batch[index];
          if (row) {
            await supabase
              .from("expo_push_tokens")
              .delete()
              .eq("token", row.token);
            removed += 1;
          }
        }
      }
    } catch {
      // Unreachable Expo. Tomorrow's run says whatever is still worth saying.
    }
  }

  return { sent, removed };
}

/**
 * Sends one notification to one user's browsers and phones.
 *
 * `webPushReady` is threaded in rather than read here so the caller decides
 * once per run instead of once per send; a deployment with no VAPID keys
 * still reaches phones.
 */
export async function fanOut(
  supabase: AdminClient,
  devices: UserDevices,
  notification: PendingNotification,
  webPushReady: boolean,
): Promise<FanOutResult> {
  const [browsers, phones] = await Promise.all([
    webPushReady
      ? sendToBrowsers(supabase, devices.browsers, notification)
      : { sent: 0, removed: 0 },
    sendToPhones(supabase, devices.phones, notification),
  ]);

  // Only for devices that actually took it, so a row that has stopped
  // working is identifiable by its age even when nothing reports it dead.
  const now = new Date().toISOString();
  if (browsers.sent > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ last_seen_at: now })
      .in(
        "endpoint",
        devices.browsers.map((row) => row.endpoint),
      );
  }
  if (phones.sent > 0) {
    await supabase
      .from("expo_push_tokens")
      .update({ last_seen_at: now })
      .in(
        "token",
        devices.phones.map((row) => row.token),
      );
  }

  return {
    sent: browsers.sent + phones.sent,
    removed: browsers.removed + phones.removed,
  };
}
