import { APP_TIME_ZONE } from "./constants";

/**
 * The kinds of thing the app tells someone, and whether they want each.
 *
 * Each notification the server sends carries one of these, and the user's
 * preferences row (`user_preferences.notification_prefs`, migration 048)
 * says which they have turned off. One switch for everything was enough
 * while there were two kinds; with the recap and the warnings there are
 * nine, and someone who wants to hear about an overdraft may not want a
 * Monday summary.
 */
export const NOTIFICATION_KINDS = [
  /** The Monday recap: last week, the month so far, what is still to come. */
  "recap",
  /** The balance looks set to go below zero before the month ends. */
  "overdraft",
  /** The reading day has come and the month is not closed; or a bank closed it. */
  "close",
  /** Tomorrow, a charge larger than usual, or one that comes once a year. */
  "bigCharge",
  /** Movements that look like a planned charge or salary has arrived. */
  "arrived",
  /** The morning after a DCA's day, while nobody has said whether it went through. */
  "dca",
  /** Bank rows waiting for a category. */
  "review",
  /** A new round amount of savings and investments reached. */
  "milestone",
  /**
   * A property's moments: half a loan repaid, its last payment, a new
   * estimate when the public record of sales adds a half-year.
   */
  "property",
  /** A new month has opened. */
  "monthOpen",
  /** The bank connection needs a renewal or has stopped. */
  "bank",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationPrefs = Partial<Record<NotificationKind, boolean>>;

/**
 * The switches an account is shown: every kind, but the property's only to
 * an account that has the Immobilier tab — the others would never hear it.
 */
export function shownNotificationKinds({
  property,
}: {
  property: boolean;
}): readonly NotificationKind[] {
  return property
    ? NOTIFICATION_KINDS
    : NOTIFICATION_KINDS.filter((kind) => kind !== "property");
}

/**
 * The stored map, read defensively: a row written by an older client, or by
 * hand, holds whatever it holds, and anything that is not a known kind set to
 * a boolean is ignored rather than trusted.
 */
export function readNotificationPrefs(value: unknown): NotificationPrefs {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const prefs: NotificationPrefs = {};
  for (const kind of NOTIFICATION_KINDS) {
    const wanted = (value as Record<string, unknown>)[kind];
    if (typeof wanted === "boolean") {
      prefs[kind] = wanted;
    }
  }
  return prefs;
}

/**
 * Whether this kind is wanted. On unless turned off: every kind was chosen to
 * be worth sending, and a kind added later reaches people the way a new
 * screen does, without anybody having to opt in to it.
 */
export function wantsNotification(
  prefs: NotificationPrefs,
  kind: NotificationKind,
): boolean {
  return prefs[kind] !== false;
}

/** Quiet from 21:00 to 08:00 in Paris: nothing is worth a buzz at night. */
const QUIET_FROM_HOUR = 21;
const QUIET_UNTIL_HOUR = 8;

/**
 * Whether an instant falls in the quiet hours, in the app's time zone.
 *
 * The crons run on UTC, so the same schedule lands an hour apart in summer
 * and winter: the evening bank sync is 22:00 in Paris half the year and
 * 23:00 the other half. Asked of the instant rather than of the cron's hour,
 * so the rule holds through both.
 */
export function isQuietHour(instant: Date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(instant),
  );
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}
