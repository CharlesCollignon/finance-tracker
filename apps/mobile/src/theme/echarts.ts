import type { ColorSchemeName } from "react-native";

import { CHART_COLORS, colorsForScheme } from "@/theme/tokens";

/**
 * The categorical series, shared with the hand-drawn marks and with web.
 *
 * This used to return [primary, destructive, success, info, muted] — which
 * spends the two colours that mean "good" and "bad" on categories that mean
 * neither, and left the app with two different palettes depending on which
 * kind of chart you were looking at.
 */
export function chartPalette(_scheme?: ColorSchemeName): string[] {
  return [...CHART_COLORS];
}

export function chartTextColor(scheme: ColorSchemeName): string {
  return colorsForScheme(scheme === "light" ? "light" : "dark").mutedForeground;
}

export function chartAxisSplitColor(scheme: ColorSchemeName): string {
  return colorsForScheme(scheme === "light" ? "light" : "dark").border;
}

export function chartTooltipColors(scheme: ColorSchemeName): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  const c = colorsForScheme(scheme === "light" ? "light" : "dark");
  return {
    backgroundColor: c.card,
    borderColor: c.border,
    textColor: c.foreground,
  };
}

/** Shared base option fragments for RN ECharts screens. */
export function baseChartOption(scheme: ColorSchemeName) {
  const text = chartTextColor(scheme);
  const split = chartAxisSplitColor(scheme);
  return {
    animationDuration: 300,
    textStyle: {
      color: text,
      fontSize: 11,
    },
    grid: {
      left: 8,
      right: 8,
      top: 16,
      bottom: 8,
      containLabel: true,
    },
    xAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: text },
    },
    yAxis: {
      splitLine: {
        lineStyle: { color: split, type: "dashed" as const },
      },
      axisLabel: { color: text },
    },
  };
}
