import { wantsNotification } from "@finance/core/notification-kinds";
import { translator } from "@finance/core/i18n/t";
import type { PendingNotification } from "@finance/core/push-digest";
import { transferReminderNotifications } from "@finance/core/push-messages";
import { getTransferReminder } from "@finance/data/dca-transfer";
import type { Recipient } from "@finance/data/preferences";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * How much to send to the broker for next month's DCAs: when the salary it
 * is sent from comes in, and two days before the 1st — each once for each
 * month it covers, by its key.
 *
 * Asked by both crons: the daily run, for the day before the 1st that has
 * come, and the refresh, straight after the bank sync that brought the
 * salary, so it is said the run it lands rather than the next morning.
 */
export async function transferFor(
  supabase: AdminClient,
  userId: string,
  today: string,
  { locale, prefs }: Recipient,
): Promise<PendingNotification[]> {
  if (!wantsNotification(prefs, "dca")) {
    return [];
  }
  const reminder = await getTransferReminder(supabase, userId, today);
  return reminder
    ? transferReminderNotifications({
        reminder,
        t: translator(locale),
        locale,
      })
    : [];
}
