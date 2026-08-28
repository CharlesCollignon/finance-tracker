import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { isOnboardingComplete, markOnboardingComplete } from "@/lib/onboarding";
import { useAuth } from "@/providers/AuthProvider";

interface OnboardingContextValue {
  /** null until the stored flag is known, so we never redirect on a guess. */
  complete: boolean | null;
  markComplete: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/**
 * Shared onboarding state.
 *
 * This has to be shared rather than read locally in the navigator: the setup
 * screen writes the flag and then navigates home, and a navigator holding its
 * own cached copy would still read "incomplete" and bounce straight back —
 * which is exactly what made Skip look broken.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [state, setState] = useState<{
    userId: string;
    complete: boolean;
  } | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    void isOnboardingComplete(userId).then((complete) => {
      if (active) {
        setState({ userId, complete });
      }
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const markComplete = useCallback(async () => {
    if (!userId) {
      return;
    }
    await markOnboardingComplete(userId);
    setState({ userId, complete: true });
  }, [userId]);

  // A stale answer from a previous account reads as unknown, not as done.
  const complete = state && state.userId === userId ? state.complete : null;

  const value = useMemo(
    () => ({ complete, markComplete }),
    [complete, markComplete],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}
