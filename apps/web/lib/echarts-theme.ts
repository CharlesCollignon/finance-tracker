import type { EChartsOption } from "echarts";

export const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function chartTextStyle() {
  return {
    color: "var(--muted-foreground)",
    fontFamily: "inherit",
    fontSize: 11,
  };
}

export function baseGrid(): NonNullable<EChartsOption["grid"]> {
  return {
    left: 8,
    right: 8,
    top: 16,
    bottom: 8,
    containLabel: true,
  };
}
