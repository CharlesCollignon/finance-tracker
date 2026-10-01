import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";

import { easeOutCubic } from "@finance/core/motion";

/** The web review's count-down time (`BankInbox.tsx`), so both run alike. */
const TWEEN_MS = 400;

/**
 * A count that runs down to its new value rather than jumping, so filing a
 * group of twenty-three reads as twenty-three things done — the web review's
 * `useTweenedCount`. Straight to the value under reduced motion.
 */
export function useTweenedCount(value: number): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const last = useRef(value);

  useEffect(() => {
    if (reduce) {
      last.current = value;
      return;
    }
    const origin = last.current;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / TWEEN_MS);
      const next = Math.round(
        origin + (value - origin) * easeOutCubic(progress),
      );
      last.current = next;
      setShown(next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return reduce ? value : shown;
}
