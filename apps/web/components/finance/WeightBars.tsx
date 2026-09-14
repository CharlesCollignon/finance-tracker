import { cn } from "@/lib/utils";
import { MICRO } from "@/lib/type-scale";

export interface WeightBarRow {
  id: string;
  label: string;
  /** Share of the whole, 0–1. */
  weight: number;
  /** Shown to the right when given. */
  detail?: string;
}

interface WeightBarsProps {
  rows: WeightBarRow[];
  /** How many rows get their own line before the rest are pooled. */
  limit?: number;
  /** Words for the pooled remainder — "4 more countries". */
  restLabel?: (count: number) => string;
  className?: string;
}

/**
 * A weighting, as a list of bars.
 *
 * Plain elements, no runtime, rendered on the server — the fourth of the five
 * marks in `components/finance/charts`, in the shape this surface needs. A
 * country split is a ranked list where the question is "how much of it is
 * that one", and a bar behind a label answers it without a legend to match
 * colours against.
 *
 * One colour, not five. `SpendStrip` needs a palette because its bands sit
 * end to end with no room for labels; here every row carries its own name, so
 * colour would be decoration competing with the figure beside it. The longest
 * bar is full width rather than the bar being a share of 100% — a portfolio
 * that is 12% Japan at most would otherwise be a column of near-invisible
 * slivers.
 */
export function WeightBars({
  rows,
  limit = 6,
  restLabel,
  className,
}: WeightBarsProps) {
  if (rows.length === 0) {
    return null;
  }

  const sorted = [...rows].sort((left, right) => right.weight - left.weight);
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const restWeight = rest.reduce((sum, row) => sum + row.weight, 0);

  const shown =
    restWeight > 0.001 && restLabel
      ? [
          ...head,
          {
            id: "rest",
            label: restLabel(rest.length),
            weight: restWeight,
          },
        ]
      : head;

  // Scaled to the largest row, so the shape of the ranking is legible even
  // when nothing reaches a fifth of the portfolio.
  const largest = Math.max(...shown.map((row) => row.weight), 0.0001);

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {shown.map((row) => (
        <li key={row.id} className="flex flex-col gap-1">
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm">{row.label}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatShare(row.weight)}
              {"detail" in row && row.detail ? (
                <span className={cn(MICRO, "ml-2 font-normal text-muted-foreground")}>
                  {row.detail}
                </span>
              ) : null}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            // The bar is decoration: the figure above it is the content, and
            // a screen reader that announced both would say everything twice.
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-[var(--chart-1)]"
              style={{ width: `${(row.weight / largest) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A share, at one decimal place at most.
 *
 * Below a tenth of a percent it reads as "<0.1%" rather than "0.0%", which
 * would say the holding is not there.
 */
function formatShare(weight: number): string {
  const percent = weight * 100;
  if (percent > 0 && percent < 0.1) {
    return "<0.1%";
  }
  return `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
}
