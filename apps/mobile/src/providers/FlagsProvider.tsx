import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  isFlagOn,
  NO_FLAGS,
  type FlagKey,
  type FlagSet,
} from "@finance/core/flags";

import { fetchFlags, loadStoredFlags } from "@/lib/flags";
import { useAuth } from "@/providers/AuthProvider";

const FlagsContext = createContext<FlagSet | null>(null);

/**
 * The feature flags for the signed-in account.
 *
 * Read once per session — at launch with a stored session, or at sign-in —
 * rather than on every screen: a flag is a rollout switch, and one that
 * changes under somebody mid-session is a screen rearranging itself for no
 * reason they can see. The cached answer shows first, so a flag that was on
 * yesterday does not blink off while the network answers; the fresh answer
 * replaces it. With neither, every flag is off.
 */
export function FlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{
    userId: string;
    flags: FlagSet;
  } | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    void (async () => {
      const stored = await loadStoredFlags(userId);
      if (active && stored) {
        setState({ userId, flags: stored });
      }
      try {
        const fresh = await fetchFlags(userId);
        if (active) {
          setState({ userId, flags: fresh });
        }
      } catch {
        // Offline, or migration 039 not run. The last answer, or none,
        // stands; the next session asks again.
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // A previous account's answer reads as nothing known, not as this one's.
  const flags = state && state.userId === userId ? state.flags : NO_FLAGS;

  return (
    <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>
  );
}

export function useFlag(key: FlagKey): boolean {
  const flags = useContext(FlagsContext);
  if (!flags) {
    throw new Error("useFlag must be used within a FlagsProvider");
  }
  return isFlagOn(flags, key);
}
