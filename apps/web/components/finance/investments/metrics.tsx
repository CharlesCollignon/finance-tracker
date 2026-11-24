"use client";

import { cn } from "@/lib/utils";

/** The wallet totals of the Placements screen, a column each. */

interface MetricProps {
  label: string;
  value: string;
  /** A second figure under the first, in its tone: a gain's percentage. */
  sub?: string | null;
  tone?: "positive" | "negative" | "neutral";
  className?: string;
}

export function Metric({
  label,
  value,
  sub = null,
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
      {sub ? (
        <p
          className={cn(
            "privacy-amount text-xs font-medium tabular-nums",
            tone === "positive" && "text-success",
            tone === "negative" && "text-destructive",
            tone === "neutral" && "text-muted-foreground",
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
