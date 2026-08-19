"use client";

import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { cn } from "@/lib/utils";
import { chartMotion } from "@/lib/echarts-theme";
import { readCssVar } from "@/lib/css-var";
import { progressTone } from "@/lib/progress-tone";

interface ProgressRingProps {
  ratio: number;
  label: string;
  detail: string;
  colorVar?: string;
  colorFallback?: string;
  over?: boolean;
  className?: string;
}

/** Thin donut progress ring with centered percent and label underneath. */
export function ProgressRing({
  ratio,
  label,
  detail,
  colorVar = "--primary",
  colorFallback = "#d4af37",
  over = false,
  className,
}: ProgressRingProps) {
  const tone = progressTone(ratio, over);

  const [fill, setFill] = useState(() =>
    readCssVar(
      tone === "danger" ? "--destructive" : colorVar,
      tone === "danger" ? "#f87171" : colorFallback,
    ),
  );
  const [track, setTrack] = useState(() =>
    readCssVar("--hairline-strong", "rgba(255,246,230,0.15)"),
  );

  useEffect(() => {
    const sync = () => {
      const nextFill = readCssVar(
        tone === "danger" ? "--destructive" : colorVar,
        tone === "danger" ? "#f87171" : colorFallback,
      );
      const nextTrack = readCssVar(
        "--hairline-strong",
        "rgba(255,246,230,0.15)",
      );
      setFill((prev) => (prev === nextFill ? prev : nextFill));
      setTrack((prev) => (prev === nextTrack ? prev : nextTrack));
    };
    sync();
    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-privacy"],
    });
    return () => observer.disconnect();
  }, [colorFallback, colorVar, tone]);

  const pct = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  const clamped = Math.min(Math.max(ratio, 0), 1);

  const option = useMemo<EChartsOption>(
    () => ({
      ...chartMotion(500),
      series: [
        {
          type: "pie",
          radius: ["72%", "88%"],
          center: ["50%", "50%"],
          silent: true,
          label: { show: false },
          labelLine: { show: false },
          data: [
            {
              value: clamped,
              itemStyle: { color: fill },
            },
            {
              value: Math.max(1 - clamped, 0.0001),
              itemStyle: { color: track, opacity: 0.35 },
              emphasis: { disabled: true },
            },
          ],
        },
      ],
    }),
    [clamped, fill, track],
  );

  return (
    <div
      className={cn(
        "flex w-[7.5rem] flex-col items-center text-center",
        className,
      )}
    >
      <div className="relative h-28 w-28">
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "svg" }}
          notMerge
        />
        <p
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums",
            tone === "danger" ? "text-destructive" : "text-foreground",
          )}
        >
          {pct}%
        </p>
      </div>
      <p className="mt-1 truncate text-sm font-medium">{label}</p>
      <p className="privacy-amount mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
        {detail}
      </p>
    </div>
  );
}
