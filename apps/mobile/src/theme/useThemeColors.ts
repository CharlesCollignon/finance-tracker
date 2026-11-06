import { COLORS } from "@/theme/tokens";

/**
 * The palette, for the places that need real colour values rather than
 * classNames — vector icons, React Navigation options and chart series.
 * Always prefer a token className (text-foreground) in JSX; this exists so
 * the imperative cases stay in step with it.
 *
 * The palette of the design on screen (`theme/designs.ts`), not the system's
 * colour scheme; a change of design remounts every screen, so this is read
 * again then.
 */
export function useThemeColors() {
  return COLORS;
}
