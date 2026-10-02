import { useCallback, useEffect, useRef, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAppForeground } from "@/hooks/useAppForeground";
import { useDataVersion } from "@/lib/data-version";
import { remindersEnabled, syncRecurringReminders } from "@/lib/notifications";
import { getRecurringTemplates } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale } from "@/providers/LocaleProvider";

const LAST_SYNC_KEY = "notifications.reminders.lastSync";

/** Rebuilding the schedule on every foreground would be wasteful. */
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function dueForSync(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (!raw) {
      return true;
    }
    return Date.now() - Number(raw) > SYNC_INTERVAL_MS;
  } catch {
    return true;
  }
}

async function markSynced(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch {
    // Ignored: at worst the schedule is rebuilt again next time.
  }
}

/**
 * Keeps the notification schedule alive.
 *
 * The reminder schedule used to be rebuilt in exactly one place — the Recurring
 * tab — so a user who enabled reminders and never went back there eventually
 * ran out of scheduled notifications and the app went silent. Syncing whenever
 * the app comes to the foreground means the schedule tracks the templates
 * wherever the user actually spends their time — and rebuilding it whenever a
 * template changes, here or on the web, means a charge moved to the 12th is
 * not still announced for the 5th.
 */
export function ReminderProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const { user } = useAuth();
  const formatAmount = useFormatCurrency();
  const templatesVersion = useDataVersion(["templates"]);

  // Kept in refs so a sync started by any of the triggers below reads the
  // latest values.
  const userId = useRef<string | null>(null);
  const format = useRef(formatAmount);
  const language = useRef(locale);
  const running = useRef(false);

  // Written in an effect rather than during render, before the effects that
  // read them.
  useEffect(() => {
    userId.current = user?.id ?? null;
    format.current = formatAmount;
    language.current = locale;
  });

  const run = useCallback(async (force: boolean) => {
    const id = userId.current;
    if (!id || running.current) {
      return;
    }
    if (!(await remindersEnabled())) {
      return;
    }

    running.current = true;
    try {
      if (force || (await dueForSync())) {
        const templates = await getRecurringTemplates(id);
        await syncRecurringReminders(templates, format.current, language.current);
        await markSynced();
      }
    } catch {
      // Reminders are a convenience; a failure here must never surface as
      // an error in the user's way.
    } finally {
      running.current = false;
    }
  }, []);

  // On sign-in, at the usual interval.
  useEffect(() => {
    void run(false);
  }, [user?.id, run]);

  // A template changed: the schedule is stale now, whatever the interval says.
  const syncedVersion = useRef(templatesVersion);
  useEffect(() => {
    if (templatesVersion !== syncedVersion.current) {
      syncedVersion.current = templatesVersion;
      void run(true);
    }
  }, [templatesVersion, run]);

  useAppForeground(() => {
    void run(false);
  });

  return <>{children}</>;
}
