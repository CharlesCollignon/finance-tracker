"use client";

import { cn } from "@/lib/utils";

/** The small figures of the Placements screen, inline and stacked. */

interface InlineMetricProps {
  label: string;
  value: string;
  /** A second figure that restates the first — the return beside the euros. */
  suffix?: string;
  tone?: "positive" | "negative" | "neutral";
}

/**
 * A label and its figure on one baseline.
 *
 * The stacked `Metric` is right for the wallet totals, where three figures get
 * a column each and the eye compares down. In a list of holdings it spends two
 * lines on what reads perfectly well as one.
 */
export function InlineMetric({
  label,
  value,
  suffix,
  tone = "neutral",
}: InlineMetricProps) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "privacy-amount font-mono font-medium tabular-nums",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </span>
      {suffix ? (
        <span
          className={cn(
            "privacy-amount font-mono tabular-nums",
            tone === "positive" && "text-success",
            tone === "negative" && "text-destructive",
            tone === "neutral" && "text-muted-foreground",
          )}
        >
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

export const PRICE_TONE_VARS: Record<
  "positive" | "negative" | "neutral",
  string
> = {
  positive: "--success",
  negative: "--destructive",
  neutral: "--muted-foreground",
};

interface MetricProps {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  className?: string;
}

export function Metric({
  label,
  value,
  tone = "neutral",
  className,
}: MetricProps) {
  return (
    <div className={cn("min-w-0 text-center", className)}>
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p
        className={cn(
          "privacy-amount mt-0.5 truncate font-mono text-sm font-semibold tabular-nums sm:text-base",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
