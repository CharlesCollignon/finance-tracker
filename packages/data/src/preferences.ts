import type { ActionResult } from "@finance/core/action-result";
import {
  DEFAULT_LOCALE,
  parseLocale,
  type Locale,
} from "@finance/core/i18n/locale";
import {
  NOTIFICATION_KINDS,
  readNotificationPrefs,
  type NotificationKind,
  type NotificationPrefs,
} from "@finance/core/notification-kinds";

import type { Db } from "./client";
import { dbError } from "./errors";
import { isMissingSchema } from "./schema";

/**
 * What a user wants to be told, the milestone they have already seen and the
 * prompts they have put away — `user_preferences` (migrations 027, 041 and
 * 048), for both apps and the crons.
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

export async function getNotificationSettings(
  db: Db,
  userId: string,
): Promise<NotificationSettings> {
  const { data, error } = await db
    .from("user_preferences")
    .select("notification_prefs, milestone_seen")
    .eq("user_id", userId)
    .maybeSingle();

  // Before migration 048 there is nothing to read, which is everything on.
  if (error || !data) {
    if (error && !isMissingSchema(error)) {
      throw error;
    }
    return NO_SETTINGS;
  }
  return {
    prefs: readNotificationPrefs(data.notification_prefs),
    milestoneSeen:
      data.milestone_seen === null ? null : Number(data.milestone_seen),
  };
}

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

/** Change the row, creating it with the reader's language if it is missing. */
async function writePreferences(
  db: Db,
  userId: string,
  locale: Locale,
  change: {
    dismissed_prompts?: string[];
    milestone_seen?: number;
    notification_prefs?: NotificationPrefs;
    measure_audience?: boolean;
  },
): Promise<ActionResult> {
  const { data: existing, error: readError } = await db
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) {
    return { error: dbError(readError) };
  }

  const { error } = existing
    ? await db
        .from("user_preferences")
        .update({ ...change, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
    : await db
        .from("user_preferences")
        .insert({ user_id: userId, locale, ...change });

  return error ? { error: dbError(error) } : { success: true };
}

/** The prompts this user has put away, on any device. */
export async function readDismissedPrompts(
  db: Db,
  userId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from("user_preferences")
    .select("dismissed_prompts")
    .eq("user_id", userId)
    .maybeSingle();
  // An invitation shown once too often is better than a screen that fails.
  return error ? [] : (data?.dismissed_prompts ?? []);
}

/**
 * Put a prompt away, for good and on every device.
 *
 * `replacing` names a family of prompts of which only the latest matters —
 * the recap of last week stops mattering once this week's is dismissed — so
 * the list does not grow by one every Monday.
 */
export async function dismissPrompt(
  db: Db,
  userId: string,
  prompt: string,
  locale: Locale,
  { replacing }: { replacing?: string } = {},
): Promise<ActionResult> {
  const dismissed = (await readDismissedPrompts(db, userId)).filter(
    (kept) => kept !== prompt && !(replacing && kept.startsWith(replacing)),
  );
  return writePreferences(db, userId, locale, {
    dismissed_prompts: [...dismissed, prompt],
  });
}

/**
 * Remember that a milestone has been celebrated, on every device. Only ever
 * raised: a device a step behind must not lower what another already showed.
 */
export async function markMilestoneSeen(
  db: Db,
  userId: string,
  amount: number,
  locale: Locale,
): Promise<ActionResult> {
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "errors.invalidInput" };
  }
  const { milestoneSeen } = await getNotificationSettings(db, userId);
  if (milestoneSeen !== null && milestoneSeen >= amount) {
    return { success: true };
  }
  return writePreferences(db, userId, locale, { milestone_seen: amount });
}

/** Turn one kind of notification on or off, on every device. */
export async function setNotificationPref(
  db: Db,
  userId: string,
  kind: NotificationKind,
  wanted: boolean,
  locale: Locale,
): Promise<ActionResult> {
  if (!NOTIFICATION_KINDS.includes(kind)) {
    return { error: "errors.invalidInput" };
  }
  const { prefs } = await getNotificationSettings(db, userId);
  return writePreferences(db, userId, locale, {
    notification_prefs: { ...prefs, [kind]: wanted },
  });
}

/**
 * Whether this account is counted in the audience figures (migration 058):
 * on unless turned off. Before the migration nothing is counted at all, and
 * the switch reads as on, which is what it will be.
 */
export async function readAudienceMeasurement(
  db: Db,
  userId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("user_preferences")
    .select("measure_audience")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) {
      return true;
    }
    throw error;
  }
  return data?.measure_audience !== false;
}

/** « Mesure d'audience » in Profile: on every device, from the next count. */
export async function setAudienceMeasurement(
  db: Db,
  userId: string,
  wanted: boolean,
  locale: Locale,
): Promise<ActionResult> {
  return writePreferences(db, userId, locale, { measure_audience: wanted });
}
