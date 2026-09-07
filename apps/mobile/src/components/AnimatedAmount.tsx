import { useEffect, useRef, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { PrivateAmount } from "@/components/PrivateAmount";
import { usePrivacy } from "@/providers/PrivacyProvider";

interface AnimatedAmountProps {
  value: number;
  format: (value: number) => string;
  className?: string;
  /** For the display sizes, which carry no text-* class. See TYPE in tokens. */
  style?: StyleProp<TextStyle>;
}

const DURATION_MS = 650;

/** Ease-out cubic — fast start, settles gently on the final figure. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Counts a figure up when it changes.
 *
 * Paired with `components/finance/AnimatedAmount.tsx` on the web, which runs
 * the same 650ms ease-out cubic for the reason given there: the two clients
 * show the same figure, so it should arrive on the same curve. This used to
 * name a vendored `CountUp` as its web counterpart, which had no call sites
 * and could not format a currency.
 *
 * Skips the animation when the value is masked (nothing to see) or the user
 * has asked for reduced motion, and always lands exactly on `value`.
 */
export function AnimatedAmount({
  value,
  format,
  className,
  style,
}: AnimatedAmountProps) {
  const { hidden } = usePrivacy();
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;

    if (reduce || hidden || from === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    let frame: number;
    const start = Date.now();

    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / DURATION_MS);
      setDisplay(from + (value - from) * easeOut(progress));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      // Settle on the target so an interrupted run never leaves a stale figure.
      fromRef.current = value;
    };
  }, [value, hidden, reduce]);

  return (
    <PrivateAmount className={className} style={style}>
      {format(display)}
    </PrivateAmount>
  );
}
