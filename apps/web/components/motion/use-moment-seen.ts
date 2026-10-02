"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether this browser has seen a moment already, so it pops once and then
 * rests ("Moments" in DESIGN.md). For a moment that happens on its own — a
 * loan half repaid while nobody was looking — rather than in a sheet the
 * user just used, where the sheet itself is the once.
 *
 * Null on the server and until the browser has been asked: the moment is
 * drawn only then, so it never shows and then pops. Storage that refuses
 * counts as never seen, which costs a second pop, not a broken page.
 */

const PREFIX = "pluclair.moment:";
const CHANGE_EVENT = "pluclair-moment-seen";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export function useMomentSeen(key: string): {
  seen: boolean | null;
  markSeen: () => void;
} {
  const seen = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(PREFIX + key) === "1";
      } catch {
        return false;
      }
    },
    () => null,
  );
  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(PREFIX + key, "1");
    } catch {
      // Refused: it pops again next time, which is all that is lost.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [key]);
  return { seen, markSeen };
}
