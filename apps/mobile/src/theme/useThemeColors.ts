import { useColorScheme } from "react-native";

import { colorsForScheme } from "@/theme/tokens";

/**
 * Palette for the active color scheme, for the places that need real color
 * values rather than classNames — vector icons, React Navigation options and
 * chart series. Always prefer a token className (text-foreground) in JSX; this
 * exists so the imperative cases stay theme-aware too.
 */
export function useThemeColors() {
  const scheme = useColorScheme();
  return colorsForScheme(scheme === "light" ? "light" : "dark");
}
