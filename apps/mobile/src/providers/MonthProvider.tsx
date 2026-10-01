import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getCurrentMonth } from "@finance/core/constants";
import type { RememberedMonth } from "@finance/core/month-memory";

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
 */
export function MonthProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<RememberedMonth>(getCurrentMonth);

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
