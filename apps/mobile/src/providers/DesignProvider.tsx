import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";
import { DEFAULT_DESIGN, type Design } from "@finance/core/designs";

import { fetchStoredDesign, loadDesign, saveDesign } from "@/lib/design";
import { useAuth } from "@/providers/AuthProvider";
import { applyDesign, designVars } from "@/theme/designs";

interface DesignContextValue {
  design: Design;
  /**
   * Draw the app in another design from now on, on this phone. The caller
   * writes the row (`saveDesignPreference`) so the web follows; this does
   * not, because the row is created with the reader's language and this
   * provider sits above the one that knows it.
   */
  setDesign: (design: Design) => void;
}

const DesignContext = createContext<DesignContextValue | null>(null);

/**
 * The design (`theme/designs.ts`): read from the phone before anything is
 * drawn, then from the account once someone is signed in, so a design picked
 * on the web follows.
 *
 * Renders nothing until the phone's own answer is in. That is a few
 * milliseconds of AsyncStorage under a splash screen that is still up — the
 * navigator hides it — and it is what stops the app opening in « Nuit » and
 * repainting a moment later.
 *
 * Directly below AuthProvider and above everything that draws, so the lock
 * screen and every sheet are inside the view that carries the design's
 * variables. A change of design remounts the navigator (`app/_layout.tsx`),
 * not this: the providers between — the biometric lock among them — keep
 * their state.
 */
export function DesignProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [design, setDesignState] = useState<Design>(DEFAULT_DESIGN);
  const [ready, setReady] = useState(false);

  const show = useCallback((next: Design) => {
    applyDesign(next);
    setDesignState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadDesign().then((stored) => {
      if (!cancelled) {
        show(stored);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [show]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId || !ready) {
      return;
    }
    let cancelled = false;
    void fetchStoredDesign(userId)
      .then(async (remote) => {
        if (cancelled) {
          return;
        }
        show(remote);
        await saveDesign(remote);
      })
      .catch(() => {
        // Offline or behind migration 088: the phone's own answer stands.
      });
    return () => {
      cancelled = true;
    };
  }, [userId, ready, show]);

  const setDesign = useCallback(
    (next: Design) => {
      show(next);
      void saveDesign(next);
    },
    [show],
  );

  const value = useMemo(() => ({ design, setDesign }), [design, setDesign]);

  if (!ready) {
    return null;
  }
  return (
    <DesignContext.Provider value={value}>
      <View style={[{ flex: 1 }, designVars(design)]}>{children}</View>
    </DesignContext.Provider>
  );
}

export function useDesign(): DesignContextValue {
  const value = useContext(DesignContext);
  if (!value) {
    throw new Error("useDesign must be used inside DesignProvider");
  }
  return value;
}
