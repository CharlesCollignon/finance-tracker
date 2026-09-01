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
const BREACH_KEY = "notifications.breach.lastNotified";

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

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
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

  if (granted) {
    await ensureChannel();
  }

  return granted;
}

export async function disableReminders(): Promise<void> {
  await setEnabledFlag(false);
  await Notifications.cancelAllScheduledNotificationsAsync();
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

function dueTomorrow(name: string, amount: string): ReminderCopy {
  return {
    title: `${name} tomorrow`,
    body: `${amount} is due. Open Pluclair to apply it.`,
  };
}

function dueToday(name: string, amount: string): ReminderCopy {
  return {
    title: `${name} today`,
    body: `${amount} is due. Open Pluclair to apply it.`,
  };
}

/**
 * The repeating trigger for a template, or null when the template needs
 * one-off dates instead (because it stops at some point).
 *
 * A repeating trigger is the whole point: it keeps firing without the app ever
 * being opened again, which the previous one-off schedule could not do.
 */
function repeatingTriggerFor(
  template: RecurringTemplateWithCategory,
): {
  trigger: Notifications.NotificationTriggerInput;
  copy: (name: string, amount: string) => ReminderCopy;
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
      copy: dueTomorrow,
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
      copy: eveningBefore ? dueTomorrow : dueToday,
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
      copy: eveningBefore ? dueTomorrow : dueToday,
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
        !occurrenceWithinSchedule(occurredOn, template.starts_on, template.ends_on)
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
  const oneYearOut = new Date();
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
  return template.ends_on > oneYearOut.toISOString().slice(0, 10);
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
): Promise<void> {
  if (!(await remindersEnabled())) {
    return;
  }

  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const active = templates.filter((template) => {
    if (!template.active) {
      return false;
    }
    // A template that has already finished should never remind.
    return (
      !template.ends_on || template.ends_on >= now.toISOString().slice(0, 10)
    );
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
      const { title, body } = repeating.copy(name, amount);
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
      const { title, body } = dueTomorrow(name, amount);
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

  await scheduleMonthOpenReminder();
}

/**
 * The monthly "your month is ready" nudge.
 *
 * Deliberately not tied to any template: it is the one reminder that still
 * arrives for a user whose templates all changed, and it lands on the day the
 * Apply step is most worth doing.
 */
async function scheduleMonthOpenReminder(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "A new month",
      body: "Apply your recurring to fill it in, and see what's left.",
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

/* --------------------------------------------------------------- breaches */

export interface BudgetBreach {
  /** Stable id for the cap, so one breach is announced once per month. */
  budgetId: string;
  label: string;
  spent: number;
  limit: number;
}

function breachKey(monthKey: string, budgetId: string): string {
  return `${monthKey}:${budgetId}`;
}

async function readNotifiedBreaches(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(BREACH_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    // A lost record means at worst one repeated notification.
    return new Set<string>();
  }
}

async function writeNotifiedBreaches(keys: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(BREACH_KEY, JSON.stringify([...keys]));
  } catch {
    // Ignored.
  }
}

/**
 * Tells the user a spending cap has been crossed.
 *
 * This cannot be a scheduled notification — it depends on data the app only
 * knows once it has loaded — so it fires when the app next has the figures in
 * hand. Each cap is announced at most once per month, because the interesting
 * event is crossing the line, not remaining over it.
 */
export async function notifyBudgetBreaches(
  breaches: BudgetBreach[],
  monthKey: string,
  formatAmount: (amount: number) => string,
): Promise<void> {
  if (breaches.length === 0 || !(await remindersEnabled())) {
    return;
  }

  const notified = await readNotifiedBreaches();
  // Only this month's records are worth keeping, so old months fall away.
  const kept = new Set(
    [...notified].filter((key) => key.startsWith(`${monthKey}:`)),
  );

  const fresh = breaches.filter(
    (breach) => !kept.has(breachKey(monthKey, breach.budgetId)),
  );

  if (fresh.length === 0) {
    await writeNotifiedBreaches(kept);
    return;
  }

  await ensureChannel();

  const [first] = fresh;
  const title =
    fresh.length === 1
      ? `${first!.label} is over budget`
      : `${fresh.length} budgets are over`;
  const body =
    fresh.length === 1
      ? `${formatAmount(first!.spent)} spent of ${formatAmount(first!.limit)}.`
      : fresh.map((breach) => breach.label).join(", ");

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });

  for (const breach of fresh) {
    kept.add(breachKey(monthKey, breach.budgetId));
  }
  await writeNotifiedBreaches(kept);
}
