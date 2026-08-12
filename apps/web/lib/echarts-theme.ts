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

/** Padded min/max so value axes zoom to data instead of anchoring at 0. */
export function paddedValueAxisRange(
  values: Array<number | null | undefined>,
  padRatio = 0.08,
): { min: number; max: number } {
  const nums = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  if (nums.length === 0) {
    return { min: 0, max: 1 };
  }

  let min = Math.min(...nums);
  let max = Math.max(...nums);

  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.05, 1);
    return { min: min - pad, max: max + pad };
  }

  const pad = (max - min) * padRatio;
  return { min: min - pad, max: max + pad };
}
