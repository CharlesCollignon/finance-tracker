import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { hapticSuccess } from "@/lib/haptics";

/**
 * Whether this phone has seen a moment already, so it pops once — with the
 * success haptic — and then rests ("Moments" in the web's DESIGN.md). For a
 * moment that happens on its own, like a loan half repaid while nobody was
 * looking, rather than in a sheet the user just used.
 *
 * Null until the storage has answered: the moment is drawn only then, so it
 * never shows and then pops. Storage that fails counts as never seen, which
 * costs a second pop, not a broken screen.
 */

const PREFIX = "pluclair.moment:";

export function useMomentSeen(key: string): boolean | null {
  const [seen, setSeen] = useState<{ key: string; value: boolean } | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PREFIX + key)
      .then((stored) => stored === "1")
      .catch(() => false)
      .then((value) => {
        if (cancelled) {
          return;
        }
        setSeen({ key, value });
        if (!value) {
          void hapticSuccess();
          void AsyncStorage.setItem(PREFIX + key, "1").catch(() => undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return seen?.key === key ? seen.value : null;
}
