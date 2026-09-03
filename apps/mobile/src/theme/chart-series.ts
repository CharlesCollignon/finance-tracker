import { useColorScheme } from "react-native";

import { CHART_COLORS } from "@/theme/tokens";

/**
 * The categorical series, in the order the palette was verified in.
 *
 * There were two palettes: this one, spread on lightness as well as hue so
 * the closest pair stays 17 ΔE apart under all three kinds of colour
 * blindness, and an ad-hoc [primary, destructive, success, info, muted] used
 * by the chart host — which spends the two colours that mean "good" and "bad"
 * on categories that mean neither. Everything categorical uses this one.
 */
export function useChartSeries(): readonly string[] {
  const scheme = useColorScheme();
  return CHART_COLORS[scheme === "light" ? "light" : "dark"];
}
