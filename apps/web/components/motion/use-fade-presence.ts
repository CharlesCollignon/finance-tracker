"use client";

import { useEffect, useState } from "react";
import { DURATION } from "@finance/core/motion";

/**
 * Keeps a closed sheet or menu on screen for the length of its fade, so it
 * leaves the way it came — opacity alone — rather than vanishing. `leaving`
 * holds for `DURATION.exit`: the block wears `fade-out` then, and `fade-in`
 * the rest of the time.
 */
export function useFadePresence(open: boolean): {
  mounted: boolean;
  leaving: boolean;
} {
  const [shown, setShown] = useState(open);

  // Opening shows it in the same render, the way React adjusts state to a
  // prop; closing waits for the fade below.
  if (open && !shown) {
    setShown(true);
  }

  useEffect(() => {
    if (open || !shown) {
      return;
    }
    const timer = window.setTimeout(() => setShown(false), DURATION.exit);
    return () => window.clearTimeout(timer);
  }, [open, shown]);

  return { mounted: open || shown, leaving: !open && shown };
}
