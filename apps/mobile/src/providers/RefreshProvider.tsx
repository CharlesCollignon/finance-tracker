import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { describePullAge, pullIsStale } from "@finance/core/bank-pull";

import { bankRefreshAvailable, refreshFromBank } from "@/lib/bank-refresh";
import { notifyDataChanged } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";

interface RefreshContextValue {
  /** Ask the bank, then tell every screen to reload. */
  refresh: () => void;
  running: boolean;
  /** "just now", "20 min ago", "never". */
  age: string;
  /** Old enough that a figure could have moved since. */
  stale: boolean;
  /** Whether asking the bank is possible on this build at all. */
  available: boolean;
  /**
   * Whether the age is knowable. False until a refresh has come back with a
   * tally to read, when the control says nothing about freshness rather than
   * claiming "never".
   */
  known: boolean;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

/** How often the age label is recomputed. It counts minutes, so twice a minute. */
const TICK_MS = 30_000;

/**
 * Refreshing from anywhere.
 *
 * Every screen has pull-to-refresh, which re-reads Supabase — correct, and
 * only ever as current as the last time the web app's cron asked the bank.
 * This is the control that asks, and it lives above the navigator so one
 * request is in flight at a time no matter which screen is showing and so the
 * "last checked" wording is the same everywhere.
 *
 * A refresh always ends in `notifyDataChanged`, whether or not the bank
 * answered: screens reload from Supabase either way, and a gesture that
 * appears to do nothing because a bank was unreachable is worse than one that
 * quietly re-reads.
 */
export function RefreshProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [lastPulledAt, setLastPulledAt] = useState<string | null>(null);
  // The phone is told the age by the server it asks, so nothing is known
  // until the first refresh comes back.
  const [known, setKnown] = useState(false);
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(() => {
    if (running) {
      return;
    }
    setRunning(true);
    void (async () => {
      const outcome = await refreshFromBank();
      if (outcome.freshness) {
        setLastPulledAt(outcome.freshness.lastPulledAt);
        setKnown(outcome.freshness.known);
      }
      setNow(new Date().toISOString());
      setRunning(false);
      // Always: the reload is what makes the gesture feel like it worked.
      notifyDataChanged();
      if (outcome.message) {
        toast(outcome.message, outcome.pulled ? "success" : "default");
      }
    })();
  }, [running, toast]);

  const value = useMemo<RefreshContextValue>(
    () => ({
      refresh,
      running,
      age: describePullAge(lastPulledAt, now),
      stale: known && pullIsStale(lastPulledAt, now),
      known,
      // Signed out there is nothing to refresh, and the auth screens should
      // not carry a control that cannot do anything.
      available: bankRefreshAvailable() && Boolean(session),
    }),
    [refresh, running, lastPulledAt, now, session, known],
  );

  return (
    <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>
  );
}

/** Null outside the provider, so a screen rendered without one still works. */
export function useRefreshAll(): RefreshContextValue | null {
  return useContext(RefreshContext);
}
