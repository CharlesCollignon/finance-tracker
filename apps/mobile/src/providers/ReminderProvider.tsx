import { useEffect, useRef, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { buildBudgetProgress } from "@finance/core/budget-limits";
import { getCurrentMonth } from "@finance/core/constants";

import { useDataVersion } from "@/lib/data-version";
import {
  notifyBudgetBreaches,
  remindersEnabled,
  syncRecurringReminders,
  type BudgetBreach,
} from "@/lib/notifications";
import {
  getBudgets,
  getCategories,
  getMonthlySummary,
  getRecurringTemplates,
} from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";

const LAST_SYNC_KEY = "notifications.reminders.lastSync";

/** Rebuilding the schedule on every foreground would be wasteful. */
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Breaches are cheap to check and only notify once per cap per month. */
const BREACH_INTERVAL_MS = 30 * 60 * 1000;

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
 * wherever the user actually spends their time.
 *
 * This is also the only moment the app can tell someone they have gone over a
 * cap, since that depends on figures it has to load first.
 */
export function ReminderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const formatAmount = useFormatCurrency();
  const dataVersion = useDataVersion();

  // Kept in refs so the AppState listener is registered once.
  const userId = useRef<string | null>(null);
  const format = useRef(formatAmount);
  const lastBreachCheck = useRef(0);
  const running = useRef(false);

  // Written in an effect rather than during render: the AppState listener
  // below is registered once and reads whatever the latest values are.
  useEffect(() => {
    userId.current = user?.id ?? null;
    format.current = formatAmount;
  });

  useEffect(() => {
    async function run(force: boolean) {
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
          await syncRecurringReminders(templates, format.current);
          await markSynced();
        }

        if (Date.now() - lastBreachCheck.current > BREACH_INTERVAL_MS) {
          lastBreachCheck.current = Date.now();
          await checkBreaches(id, format.current);
        }
      } catch {
        // Reminders are a convenience; a failure here must never surface as
        // an error in the user's way.
      } finally {
        running.current = false;
      }
    }

    void run(false);

    function handleChange(state: AppStateStatus) {
      if (state === "active") {
        void run(false);
      }
    }

    const subscription = AppState.addEventListener("change", handleChange);
    return () => subscription.remove();
    // dataVersion re-runs the check after a write, so crossing a cap by adding
    // a transaction is noticed straight away rather than at the next launch.
  }, [user?.id, dataVersion]);

  return <>{children}</>;
}

async function checkBreaches(
  userId: string,
  formatAmount: (amount: number) => string,
): Promise<void> {
  const { year, month } = getCurrentMonth();

  const [summary, budgets, categories] = await Promise.all([
    getMonthlySummary(userId, year, month, "current"),
    getBudgets(userId),
    getCategories(userId),
  ]);

  if (budgets.length === 0) {
    return;
  }

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name] as const),
  );

  const breaches: BudgetBreach[] = buildBudgetProgress(
    budgets,
    summary.expenseBreakdown,
    summary.expenses,
    categoryNames,
  )
    .filter((row) => row.over)
    .map((row) => ({
      budgetId: row.budgetId,
      label: row.label,
      spent: row.spent,
      limit: row.limit,
    }));

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  await notifyBudgetBreaches(breaches, monthKey, formatAmount);
}
