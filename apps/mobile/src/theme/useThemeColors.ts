import { COLORS } from "@/theme/tokens";

/**
 * The palette, for the places that need real colour values rather than
 * classNames — vector icons, React Navigation options and chart series.
 * Always prefer a token className (text-foreground) in JSX; this exists so
 * the imperative cases stay in step with it.
 *
 * No longer reads the system colour scheme: Pluclair is dark, and the app
 * pins the scheme at boot so NativeWind's `dark:` variants agree.
 */
export function useThemeColors() {
  return COLORS;
}
