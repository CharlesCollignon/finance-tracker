import { DURATION, EASE_STANDARD } from "@finance/core/motion";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** The arrival, as a `motion/react` transition. */
export const FADE_IN = { duration: DURATION.enter / 1000, ease: EASE };

/** The departure, quicker than the arrival. */
export const FADE_OUT = { duration: DURATION.exit / 1000, ease: EASE };

/**
 * How a block arrives and leaves under `motion/react`: opacity alone, in on
 * `DURATION.enter` and out on `DURATION.exit` — the CSS `fade-in` and
 * `fade-out`, for what has to fade before it unmounts. Spread it on an `m.*`
 * element: `<m.div {...FADE}>`.
 */
export const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: FADE_OUT },
  transition: FADE_IN,
};

/**
 * The same fade for a block that also opens or closes its height, so what
 * sits under it moves on the same two numbers instead of jumping.
 */
export const FADE_HEIGHT = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0, transition: FADE_OUT },
  transition: FADE_IN,
};
