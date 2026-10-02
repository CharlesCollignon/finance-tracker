import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getCurrentMonth } from "@finance/core/constants";
import type { RememberedMonth } from "@finance/core/month-memory";

import { useAppForeground } from "@/hooks/useAppForeground";

interface MonthContextValue extends RememberedMonth {
  setMonth: (year: number, month: number) => void;
}

const MonthContext = createContext<MonthContextValue | null>(null);

/**
 * The month the user is looking at, carried between the month-scoped screens
 * — Le point, the Journal and its calendar — as the web carries it in a
 * session cookie (`lib/month-memory.ts` there). Picking March on the Journal
 * and switching to the calendar used to throw the reader back to today.
 *
 * Held for the life of the app rather than stored: a session is what the web
 * keeps it for, and an app reopened tomorrow should open on tomorrow's month.
 *
 * Which a phone rarely does: the app is left in the background for days and
 * brought back, not reopened. So coming back counts too. Someone who left it
 * on the month in progress is shown the month in progress, which on the
 * first of October is October; someone who left it on March, on purpose, is
 * still on March.
 */
export function MonthProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<RememberedMonth>(getCurrentMonth);
  // The month that was in progress the last time anyone looked.
  const inProgress = useRef(getCurrentMonth());

  useAppForeground(() => {
    const was = inProgress.current;
    const now = getCurrentMonth();
    inProgress.current = now;
    if (was.year === now.year && was.month === now.month) {
      return;
    }
    setShown((current) =>
      current.year === was.year && current.month === was.month ? now : current,
    );
  });

  const setMonth = useCallback((year: number, month: number) => {
    setShown((current) =>
      current.year === year && current.month === month
        ? current
        : { year, month },
    );
  }, []);

  const value = useMemo(
    () => ({ year: shown.year, month: shown.month, setMonth }),
    [shown, setMonth],
  );

  return (
    <MonthContext.Provider value={value}>{children}</MonthContext.Provider>
  );
}

/** The month shared by the month-scoped screens, and the way to change it. */
export function useScreenMonth(): MonthContextValue {
  const context = useContext(MonthContext);
  if (!context) {
    throw new Error("useScreenMonth must be used within MonthProvider");
  }
  return context;
}
