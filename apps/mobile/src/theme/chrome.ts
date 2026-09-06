import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Tab bar height above the bottom inset, at the system's default text size. */
const TAB_BAR_BASE = 60;

/**
 * How far fixed chrome is allowed to grow with the system text size.
 *
 * Body copy scales without a ceiling — that is the point of Dynamic Type — but
 * a bar built to a constant height cannot, and clipping its labels is worse
 * than bounding them. So the bar grows with the setting up to this multiple and
 * stops, rather than staying at one height and cropping.
 */
export const CHROME_MAX_FONT_SCALE = 1.4;

/** The system text scale, bounded for use in chrome heights. Reactive. */
export function useChromeFontScale() {
  const { fontScale } = useWindowDimensions();
  return Math.min(fontScale, CHROME_MAX_FONT_SCALE);
}

/** Height of the tab bar itself, excluding the bottom safe-area inset. */
export function useTabBarHeight() {
  return Math.round(TAB_BAR_BASE * useChromeFontScale());
}

/**
 * Bottom padding a scrolling screen needs so its last row clears the tab bar.
 *
 * The bar overlays content rather than docking beside it — blur only means
 * something if content passes beneath — so nothing pads for it automatically,
 * and expo-router 57 exports no tab-bar-height hook to ask. Screens take the
 * number from here so it tracks the bar it is clearing instead of being
 * restated as a `pb-` class on each one.
 */
export function useTabBarClearance(extra = 16) {
  const insets = useSafeAreaInsets();
  return useTabBarHeight() + insets.bottom + extra;
}
