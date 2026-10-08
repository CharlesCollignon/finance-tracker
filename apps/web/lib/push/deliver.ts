import {
  isQuietHour,
  wantsNotification,
} from "@finance/core/notification-kinds";
import {
  notificationsToSay,
  type PendingNotification,
} from "@finance/core/push-digest";
import type { Recipient } from "@finance/data/preferences";
import type { createAdminClient } from "@/lib/supabase/admin";
import { fanOut, readDevicesFor, type UserDevices } from "@/lib/push/send";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export interface Delivery {
  /** Devices that took a message. */
  sent: number;
  /** Notifications held back: quiet hours, a kind turned off, or said already. */
  held: number;
}

/**
 * Say these things to one person, if they want them and it is not the night.
 *
 * Every cron that pushes goes through here, so the rules are the same
 * whoever is speaking:
 * - a kind the person turned off is not sent (`notification_prefs`);
 * - nothing is sent between 21:00 and 08:00 in Paris. A held notification is
 *   not logged, so whatever produced it is free to produce it again on the
 *   next run in the day — which is why the rules feeding this one describe a
 *   change since the person was last told rather than the moment it happened;
 * - a key already in `notification_log` is not said twice, nor one another
 *   push sent with it says as well (`covers`);
 * - what is about to be sent is logged first. A duplicate is a worse outcome
 *   than a miss, and a crash mid-send would otherwise repeat it tomorrow.
 *   One row per user rather than per device, so "said once" holds across a
 *   laptop and a phone.
 *
 * The dedupe read is by exact key. The daily run used to fetch only the keys
 * that mentioned the month, which silently resent anything keyed otherwise
 * — a consent ending next month, a weekly recap — every single day.
 */
export async function deliver(
  supabase: AdminClient,
  userId: string,
  recipient: Recipient,
  notifications: readonly PendingNotification[],
  {
    devices,
    webPushReady,
    now = new Date(),
  }: { devices?: UserDevices; webPushReady: boolean; now?: Date },
): Promise<Delivery> {
  const wanted = notifications.filter((notification) =>
    wantsNotification(recipient.prefs, notification.kind),
  );
  if (wanted.length === 0 || isQuietHour(now)) {
    return { sent: 0, held: notifications.length };
  }

  const { data: already } = await supabase
    .from("notification_log")
    .select("key")
    .eq("user_id", userId)
    .in(
      "key",
      wanted.map((notification) => notification.key),
    );
  const { send: fresh, log } = notificationsToSay(
    wanted,
    new Set((already ?? []).map((row) => row.key)),
  );
  if (fresh.length === 0) {
    return { sent: 0, held: notifications.length };
  }

  const reach = devices ?? (await readDevicesFor(supabase, userId));
  if (reach.browsers.length === 0 && reach.phones.length === 0) {
    return { sent: 0, held: notifications.length };
  }

  await supabase.from("notification_log").upsert(
    log.map((key) => ({ user_id: userId, key })),
    { onConflict: "user_id,key", ignoreDuplicates: true },
  );

  let sent = 0;
  for (const notification of fresh) {
    sent += (await fanOut(supabase, reach, notification, webPushReady)).sent;
  }
  return { sent, held: notifications.length - fresh.length };
}
