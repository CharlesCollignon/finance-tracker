import {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { DURATION, EASE_STANDARD } from "@finance/core/motion";

const EASING = Easing.bezier(...EASE_STANDARD);

/**
 * How a block arrives: opacity alone, on `DURATION.enter`. Since October
 * 2026 nothing in the app rises, slides, zooms or springs into place — the
 * web's `fade-in`, as Reanimated says it.
 */
export const FADE_IN = FadeIn.duration(DURATION.enter).easing(EASING);

/** How a block leaves: the same fade, on the quicker `DURATION.exit`. */
export const FADE_OUT = FadeOut.duration(DURATION.exit).easing(EASING);

/**
 * The rows around a block that arrives or leaves, closing up on the same
 * curve and the arrival's duration instead of jumping.
 */
export const LAYOUT = LinearTransition.duration(DURATION.enter).easing(EASING);
