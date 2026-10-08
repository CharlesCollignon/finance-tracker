import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  getRecurringOccurrenceDates,
  occurrenceWithinSchedule,
} from "@finance/core/recurrence";
import { todayIsoLocal } from "@finance/core/constants";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import {
  wantsNotification,
  type NotificationPrefs,
} from "@finance/core/notification-kinds";
import { getNotificationSettings } from "@finance/data/preferences";

import { supabase } from "@/lib/supabase";

const ENABLED_KEY = "notifications.reminders.enabled";
const ASKED_KEY = "notifications.reminders.asked";

/** Reminders fire the evening before, which is when they are still actionable. */
const REMIND_HOUR = 19;

/** Used when there is no "evening before" inside the same month or week. */
const SAME_DAY_HOUR = 9;

/**
 * iOS keeps at most 64 pending notifications and silently drops the rest, so
 * the repeating set is capped well below that with room for the month-open
 * reminder and any bounded templates.
 */
const MAX_TEMPLATE_REMINDERS = 40;

/** Horizon for templates that have an end date and so cannot repeat forever. */
const BOUNDED_HORIZON_DAYS = 120;

const CHANNEL_ID = "reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function remindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function remindersAsked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === "1";
  } catch {
    return true;
  }
}

/**
 * Whether to offer notifications after a save, on the toast that confirms
 * it: once per device, and only while the system can still ask — never where
 * they are already on or were refused for good.
 */
export async function shouldOfferReminders(): Promise<boolean> {
  if (await remindersAsked()) {
    return false;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) {
    await markRemindersAsked();
    return false;
  }
  return true;
}

export async function markRemindersAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, "1");
  } catch {
    // Ignored: the prompt reappearing is better than blocking the caller.
  }
}

async function setEnabledFlag(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // Ignored.
  }
}

/** The channel's name is what Android's settings list it under. */
async function ensureChannel(locale: Locale): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: translator(locale)("reminders.channelName"),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Registers this device with Expo, so a server can reach it.
 *
 * Two different things wear the word "notification" in this app, and only one
 * of them used to work here. A reminder is something the phone already knows
 * — a template says rent leaves on the 5th, so the evening of the 4th can be
 * scheduled months ahead without anyone being asked anything. News is not:
 * the overnight bank sync leaving six entries needing a category is a fact
 * about the world, and the phone has no way to have it. The browser was told
 * and the app was not, which is how six entries could sit unfiled while the
 * Month screen showed figures that were short by whatever they hold.
 *
 * Best-effort, but not silent. The token is a convenience on top of the local
 * schedule, so nothing here is allowed to be the reason the switch fails to
 * turn on — the reminders still fire without it. It does say whether it
 * worked, though, because the alternative is the failure this whole change
 * was about: a switch that reports success and then nothing ever arrives,
 * with nowhere to find out why. Expo Go on Android cannot get a token at
 * all, and neither can a build whose project has no FCM key uploaded.
 */
async function registerPushToken(): Promise<boolean> {
  // A simulator has no push service to register with, and asking anyway
  // throws.
  if (!Device.isDevice) {
    return false;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    return false;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    // Upserted on the token: Expo hands back the same one for the same
    // install, and a second row would mean two copies of every notification.
    const { error } = await supabase.from("expo_push_tokens").upsert(
      {
        user_id: user.id,
        token,
        platform: Platform.OS,
        device_name: Device.deviceName,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );

    // A token Expo gave us but we failed to store is no better than none:
    // the server reads this table, not the device.
    return !error;
  } catch {
    // No token to be had — Expo Go on Android, a project with no FCM key, or
    // a device that happens to be offline as the switch is flipped.
    return false;
  }
}

/** Stop a server being able to reach this device. */
async function forgetPushToken(): Promise<void> {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      return;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    // By token rather than by user: turning notifications off on this phone
    // should not silence the user's other devices.
    await supabase.from("expo_push_tokens").delete().eq("token", token);
  } catch {
    // Nothing to forget, or no way to ask what to forget.
  }
}

/** What turning notifications on actually achieved. */
export interface ReminderOptIn {
  /** Whether the OS will let this app show anything at all. */
  granted: boolean;
  /**
   * Whether a server can now reach this device.
   *
   * False is an ordinary outcome, not an error: the schedule this app builds
   * on the device works either way. What it costs is the half a phone cannot
   * schedule for itself — a cap broken overnight, or the bank sync leaving
   * entries needing a category — so it is worth saying out loud rather than
   * leaving someone to conclude the switch does nothing.
   */
  remoteReady: boolean;
}

/**
 * Requests permission. Only ever called from an explicit opt-in — asking on
 * first launch is the standard way to get denied permanently.
 *
 * The channel is created before the request, not after. On Android 13 the
 * system prompt does not appear until the app has at least one notification
 * channel, so creating it afterwards meant the request resolved against
 * whatever the OS had decided on its own and the switch could report a denial
 * the user was never shown.
 */
export async function enableReminders(locale: Locale): Promise<ReminderOptIn> {
  await ensureChannel(locale);

  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted || (await Notifications.requestPermissionsAsync()).granted;

  await markRemindersAsked();
  await setEnabledFlag(granted);

  return {
    granted,
    remoteReady: granted ? await registerPushToken() : false,
  };
}

export async function disableReminders(): Promise<void> {
  await setEnabledFlag(false);
  await Notifications.cancelAllScheduledNotificationsAsync();
  await forgetPushToken();
}

const channelId = Platform.OS === "android" ? CHANNEL_ID : undefined;

/** ISO weekday (1 = Monday … 7 = Sunday) → Expo weekday (1 = Sunday … 7). */
function toExpoWeekday(isoWeekday: number): number {
  return isoWeekday === 7 ? 1 : isoWeekday + 1;
}

function previousIsoWeekday(isoWeekday: number): number {
  return isoWeekday === 1 ? 7 : isoWeekday - 1;
}

interface ReminderCopy {
  title: string;
  body: string;
}

/** Whether a reminder fires the evening before its day or on the morning. */
type ReminderWhen = "tomorrow" | "today";

/*
 * Nothing to apply any more: a charge writes itself into its month, so the
 * reminder only says what is coming. It used to end "Open Pluclair to apply
 * it", from when every month had to be filled by hand.
 */
function reminderCopy(
  when: ReminderWhen,
  name: string,
  amount: string,
  locale: Locale,
): ReminderCopy {
  const t = translator(locale);
  return {
    title: t(
      when === "tomorrow"
        ? "reminders.dueTomorrowTitle"
        : "reminders.dueTodayTitle",
      { name },
    ),
    body: t("reminders.dueBody", { amount }),
  };
}

/**
 * The repeating trigger for a template, or null when the template needs
 * one-off dates instead (because it stops at some point).
 *
 * A repeating trigger is the whole point: it keeps firing without the app ever
 * being opened again, which the previous one-off schedule could not do.
 */
function repeatingTriggerFor(template: RecurringTemplateWithCategory): {
  trigger: Notifications.NotificationTriggerInput;
  when: ReminderWhen;
} | null {
  const recurrence = template.recurrence ?? "monthly";

  if (recurrence === "weekly" && template.day_of_week) {
    return {
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: toExpoWeekday(previousIsoWeekday(template.day_of_week)),
        hour: REMIND_HOUR,
        minute: 0,
        channelId,
      },
      when: "tomorrow",
    };
  }

  if (recurrence === "yearly" && template.month_of_year) {
    const day = template.day_of_month ?? 1;
    // Stepping back a day across a month boundary is not expressible as a
    // yearly trigger, so those remind on the morning of instead.
    const eveningBefore = day >= 2;
    return {
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        // Expo takes JavaScript month ranges here, where January is 0.
        month: template.month_of_year - 1,
        day: eveningBefore ? day - 1 : day,
        hour: eveningBefore ? REMIND_HOUR : SAME_DAY_HOUR,
        minute: 0,
        channelId,
      },
      when: eveningBefore ? "tomorrow" : "today",
    };
  }

  if (recurrence === "monthly") {
    const day = template.day_of_month ?? 1;
    // Same boundary problem: the evening before the 1st is last month.
    const eveningBefore = day >= 2;
    return {
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: eveningBefore ? day - 1 : day,
        hour: eveningBefore ? REMIND_HOUR : SAME_DAY_HOUR,
        minute: 0,
        channelId,
      },
      when: eveningBefore ? "tomorrow" : "today",
    };
  }

  return null;
}

function atLocalHour(isoDate: string, hour: number): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!, hour, 0, 0, 0);
}

/** One-off dates for a template that stops, so it does not remind forever. */
function boundedDatesFor(
  template: RecurringTemplateWithCategory,
  now: Date,
): Date[] {
  const horizon = new Date(
    now.getTime() + BOUNDED_HORIZON_DAYS * 24 * 60 * 60 * 1000,
  );
  const dates: Date[] = [];

  for (let offset = 0; offset <= 4; offset += 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const occurrences = getRecurringOccurrenceDates(
      {
        recurrence: template.recurrence ?? "monthly",
        day_of_month: template.day_of_month,
        day_of_week: template.day_of_week,
        month_of_year: template.month_of_year,
      },
      cursor.getFullYear(),
      cursor.getMonth() + 1,
    );

    for (const occurredOn of occurrences) {
      if (
        !occurrenceWithinSchedule(
          occurredOn,
          template.starts_on,
          template.ends_on,
        )
      ) {
        continue;
      }
      const when = atLocalHour(occurredOn, REMIND_HOUR);
      when.setDate(when.getDate() - 1);
      if (when > now && when <= horizon) {
        dates.push(when);
      }
    }
  }

  return dates;
}

/** True when the template will still be running a year from now. */
function isOpenEnded(template: RecurringTemplateWithCategory): boolean {
  if (!template.ends_on) {
    return true;
  }
  // From today in Paris, not in UTC: between midnight and two in the morning
  // the UTC date is still yesterday's. Compared as text, so the 29th of
  // February a year on needs no calendar to exist.
  const today = todayIsoLocal();
  const oneYearOut = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  return template.ends_on > oneYearOut;
}

/**
 * Rebuilds the whole schedule from the current templates.
 *
 * Everything is cancelled first because a template's amount or day may have
 * changed, and a stale reminder is worse than none.
 *
 * Open-ended templates get repeating triggers, so the schedule survives a user
 * who never opens the app again. Only templates with an end date fall back to
 * one-off dates, and those stop being relevant on their own.
 */
export async function syncRecurringReminders(
  templates: RecurringTemplateWithCategory[],
  formatAmount: (amount: number) => string,
  locale: Locale,
): Promise<void> {
  if (!(await remindersEnabled())) {
    return;
  }

  await ensureChannel(locale);
  await Notifications.cancelAllScheduledNotificationsAsync();

  // A phone the server can reach hears from the server: the evening-before
  // word for the large and the yearly charges, the reading day, the Monday
  // recap — the same messages as the user's other devices, under the same
  // switches and quiet hours. The schedule below is for a phone it cannot
  // reach (Expo Go on Android, a build without an FCM key), which would
  // otherwise hear nothing at all. It reminds of every charge rather than
  // only the large ones, having no history to judge "large" by, and follows
  // the same switches: « Grosse dépense demain » governs these reminders and
  // « Nouveau mois » the month opening. Registering again is also what keeps
  // the token's `last_seen_at` honest for a phone still in use.
  if (await registerPushToken()) {
    return;
  }

  const prefs = await readOwnPrefs();
  if (!wantsNotification(prefs, "bigCharge")) {
    await scheduleMonthOpenIfWanted(prefs, locale);
    return;
  }

  const now = new Date();
  const today = todayIsoLocal();
  const active = templates.filter((template) => {
    if (!template.active) {
      return false;
    }
    // A template that has already finished should never remind — finished
    // by the calendar here, which the UTC date lags by an hour or two.
    return !template.ends_on || template.ends_on >= today;
  });

  let scheduled = 0;

  for (const template of active) {
    if (scheduled >= MAX_TEMPLATE_REMINDERS) {
      break;
    }

    const name = template.categories.name;
    const amount = formatAmount(Number(template.amount));

    if (isOpenEnded(template)) {
      const repeating = repeatingTriggerFor(template);
      if (!repeating) {
        continue;
      }
      const { title, body } = reminderCopy(
        repeating.when,
        name,
        amount,
        locale,
      );
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: repeating.trigger,
      });
      scheduled += 1;
      continue;
    }

    for (const when of boundedDatesFor(template, now)) {
      if (scheduled >= MAX_TEMPLATE_REMINDERS) {
        break;
      }
      const { title, body } = reminderCopy("tomorrow", name, amount, locale);
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId,
        },
      });
      scheduled += 1;
    }
  }

  // The server says this on the 1st to every device it can reach
  // (`push.monthOpen`); this phone is one it cannot.
  await scheduleMonthOpenIfWanted(prefs, locale);
}

/**
 * The account's notification switches, read here so that every caller
 * schedules by them. Everything on when they cannot be read, which is what
 * a missing preferences row means anyway.
 */
async function readOwnPrefs(): Promise<NotificationPrefs> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return {};
    }
    return (await getNotificationSettings(supabase, session.user.id)).prefs;
  } catch {
    return {};
  }
}

async function scheduleMonthOpenIfWanted(
  prefs: NotificationPrefs,
  locale: Locale,
): Promise<void> {
  if (wantsNotification(prefs, "monthOpen")) {
    await scheduleMonthOpenReminder(locale);
  }
}

/**
 * The monthly "your month is ready" nudge, for a phone no server can reach.
 *
 * Deliberately not tied to any template: it is the one reminder that still
 * arrives for a user whose templates all changed.
 */
async function scheduleMonthOpenReminder(locale: Locale): Promise<void> {
  const t = translator(locale);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t("reminders.monthOpenTitle"),
      body: t("reminders.monthOpenBody"),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: 1,
      hour: SAME_DAY_HOUR,
      minute: 0,
      channelId,
    },
  });
}
