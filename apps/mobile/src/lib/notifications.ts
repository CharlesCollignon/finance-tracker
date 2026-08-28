import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  getRecurringOccurrenceDates,
  occurrenceWithinSchedule,
} from "@finance/core/recurrence";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";

const ENABLED_KEY = "notifications.reminders.enabled";
const ASKED_KEY = "notifications.reminders.asked";

/** Reminders fire the evening before, which is when they are still actionable. */
const REMIND_HOUR = 19;
const DAYS_AHEAD = 45;
const MAX_SCHEDULED = 20;

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

/**
 * Requests permission. Only ever called from an explicit opt-in — asking on
 * first launch is the standard way to get denied permanently.
 */
export async function enableReminders(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted || (await Notifications.requestPermissionsAsync()).granted;

  await markRemindersAsked();
  await setEnabledFlag(granted);

  if (granted && Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return granted;
}

export async function disableReminders(): Promise<void> {
  await setEnabledFlag(false);
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function atLocalHour(isoDate: string, hour: number): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

/**
 * Rebuilds the schedule from the current templates. Everything is cancelled
 * first because a template's amount or day may have changed, and a stale
 * reminder is worse than none.
 */
export async function syncRecurringReminders(
  templates: RecurringTemplateWithCategory[],
  formatAmount: (amount: number) => string,
): Promise<void> {
  if (!(await remindersEnabled())) {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const horizon = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);

  const upcoming: { when: Date; title: string; body: string }[] = [];

  for (const template of templates) {
    if (!template.active) {
      continue;
    }
    // Cover this month and the next, which spans the 45-day horizon.
    for (let offset = 0; offset <= 1; offset++) {
      const cursor = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const dates = getRecurringOccurrenceDates(
        template,
        cursor.getFullYear(),
        cursor.getMonth() + 1,
      );

      for (const date of dates) {
        if (
          !occurrenceWithinSchedule(date, template.starts_on, template.ends_on)
        ) {
          continue;
        }
        // Fire the evening before.
        const when = atLocalHour(date, REMIND_HOUR);
        when.setDate(when.getDate() - 1);
        if (when <= now || when > horizon) {
          continue;
        }
        upcoming.push({
          when,
          title: `${template.categories.name} tomorrow`,
          body: `${formatAmount(Number(template.amount))} is due. Open Pluclair to apply it.`,
        });
      }
    }
  }

  upcoming.sort((a, b) => a.when.getTime() - b.when.getTime());

  for (const item of upcoming.slice(0, MAX_SCHEDULED)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: item.title, body: item.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.when,
        channelId: Platform.OS === "android" ? "reminders" : undefined,
      },
    });
  }
}
