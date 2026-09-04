"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  describePullAge,
  pullIsStale,
  type PullFreshness,
} from "@finance/core/bank-pull";
import { refreshEverythingAction } from "@/lib/actions/refresh";
import { useToast } from "@/components/layout/ToastProvider";

interface RefreshValue {
  /** Ask the bank and re-read everything. */
  refresh: () => void;
  running: boolean;
  /** "just now", "20 min ago", "never" — recomputed as the clock moves. */
  age: string;
  /** Old enough that a figure could have moved since. */
  stale: boolean;
  /** Whether a bank is connected at all, which decides what the control says. */
  connected: boolean;
  /**
   * Whether the age is knowable. False until migration 022 exists, when the
   * control should say nothing about freshness rather than claim "never".
   */
  known: boolean;
}

const RefreshContext = createContext<RefreshValue | null>(null);

/** How often the age label is recomputed. A minute, because it counts minutes. */
const TICK_MS = 30_000;

/**
 * Refreshing from anywhere.
 *
 * The refresh used to live on the Ledger, inside the bank inbox — which is
 * where the rows land, but not where the question is asked. "Has that
 * transfer arrived" is asked while looking at the month, and making someone
 * navigate to another surface to find out teaches them that the number on
 * screen cannot be trusted.
 *
 * So the state lives in the app layout and the control renders in the page
 * header, which every surface already has. One source of truth for how old
 * the data is, one request in flight at a time no matter how many buttons are
 * on screen, and the age label ticks on its own rather than only when
 * something else causes a render.
 */
export function RefreshProvider({
  children,
  initial,
  connected,
}: {
  children: ReactNode;
  /** The freshness the server rendered with, or null without a connection. */
  initial: PullFreshness | null;
  connected: boolean;
}) {
  const { toast } = useToast();
  const [running, startTransition] = useTransition();
  const [lastPulledAt, setLastPulledAt] = useState<string | null>(
    initial?.lastPulledAt ?? null,
  );
  const [known, setKnown] = useState(initial?.known ?? false);
  // Held in state rather than read from `Date.now()` at render time, so the
  // server and the first client render agree on it. A label computed from the
  // live clock during hydration is a mismatch by construction.
  const [now, setNow] = useState<string | null>(null);

  // Only the interval sets it. Reading the clock in the effect body as well
  // would be a synchronous setState during an effect, and it buys nothing:
  // the server computed its wording moments before this mounted, so it is
  // right until the first tick makes it wrong.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await refreshEverythingAction();
      if (result.freshness) {
        setLastPulledAt(result.freshness.lastPulledAt);
        setKnown(result.freshness.known);
      }
      setNow(new Date().toISOString());
      toast(
        result.error ?? result.message ?? "Up to date",
        result.error ? "error" : "success",
      );
    });
  }, [toast]);

  const value = useMemo<RefreshValue>(() => {
    // Before the first tick the server's own wording is used verbatim, so
    // there is nothing to hydrate differently.
    if (now === null) {
      return {
        refresh,
        running,
        age: initial?.age ?? "never",
        stale: initial?.stale ?? false,
        connected,
        known,
      };
    }

    return {
      refresh,
      running,
      age: describePullAge(lastPulledAt, now),
      stale: known && pullIsStale(lastPulledAt, now),
      connected,
      known,
    };
  }, [
    connected,
    initial?.age,
    initial?.stale,
    known,
    lastPulledAt,
    now,
    refresh,
    running,
  ]);

  return (
    <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>
  );
}

/**
 * Null outside the provider, which is how the marketing pages and the auth
 * screens get the same header components without a refresh they cannot serve.
 */
export function useRefresh(): RefreshValue | null {
  return useContext(RefreshContext);
}
