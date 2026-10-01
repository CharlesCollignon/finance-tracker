import {
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import {
  readNotificationPrefs,
  type NotificationPrefs,
} from "@finance/core/notification-kinds";

import type { Db } from "./client";
import { isMissingSchema } from "./schema";

/**
 * What a user wants to be told, and the milestone they have already seen —
 * `user_preferences` (migrations 027 and 048), for both apps and the crons.
 *
 * The row is created lazily, so every write here creates it when it is not
 * there yet — with the reader's current language, because a new row's own
 * default would otherwise decide the language of every push that follows.
 */

export interface NotificationSettings {
  prefs: NotificationPrefs;
  /** The highest milestone already celebrated, or null for none yet. */
  milestoneSeen: number | null;
}

/** What one person will be sent, read by the crons for everyone at once. */
export interface Recipient extends NotificationSettings {
  locale: Locale;
}

const NO_SETTINGS: NotificationSettings = { prefs: {}, milestoneSeen: null };

/**
 * Everyone's language and choices in one read, for a cron that has no
 * browser and no session to ask. A user with no row is absent from the map
 * and gets the default language with every kind on.
 */
export async function readRecipients(
  db: Db,
  userIds: readonly string[],
): Promise<Map<string, Recipient>> {
  const byUser = new Map<string, Recipient>();
  if (userIds.length === 0) {
    return byUser;
  }

  let { data, error } = await db
    .from("user_preferences")
    .select("user_id, locale, notification_prefs, milestone_seen")
    .in("user_id", [...userIds]);

  // A deployment behind migration 048 still has the language to read.
  if (error && isMissingSchema(error)) {
    const fallback = await db
      .from("user_preferences")
      .select("user_id, locale")
      .in("user_id", [...userIds]);
    data = (fallback.data ?? []).map((row) => ({
      ...row,
      notification_prefs: {},
      milestone_seen: null,
    }));
    error = null;
  }
  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    byUser.set(row.user_id, {
      locale: parseLocale(row.locale) ?? DEFAULT_LOCALE,
      prefs: readNotificationPrefs(row.notification_prefs),
      milestoneSeen:
        row.milestone_seen === null ? null : Number(row.milestone_seen),
    });
  }
  return byUser;
}

/** The recipient a user with no preferences row is. */
export function defaultRecipient(): Recipient {
  return { locale: DEFAULT_LOCALE, ...NO_SETTINGS };
}
