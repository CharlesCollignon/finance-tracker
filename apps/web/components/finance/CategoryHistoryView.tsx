"use client";

import { useMemo, useState } from "react";
import { TrendDown, TrendUp } from "@phosphor-icons/react";
import type { CategoryHistory } from "@finance/core/category-history";
import { CATEGORY_TYPE_LABELS } from "@finance/core/category-styles";
import { Card } from "@/components/retroui/Card";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";

interface CategoryHistoryViewProps {
  histories: CategoryHistory[];
  months: number;
}

/** Which chart token a category type is drawn in. */
const TONE: Record<string, string> = {
  expense: "var(--chart-2)",
  income: "var(--chart-3)",
  savings: "var(--chart-4)",
  investment: "var(--chart-1)",
};

/**
 * One category's months, as bars.
 *
 * Drawn the way the landing mocks are — plain elements sized by percentage
 * and coloured with the chart tokens — rather than through the charting
 * library the dashboard uses. Twelve bars need no axis engine, no tooltip
 * layer and no zoom, and doing it this way keeps the page server-rendered
 * and weightless.
 */
function Bars({ history }: { history: CategoryHistory }) {
  const formatMoney = useFormatCurrency();
  const tone = TONE[history.type] ?? "var(--chart-1)";
  // Against the peak rather than a round number, so the shape of the run is
  // what shows rather than the scale it happens to sit at.
  const scale = history.peak > 0 ? history.peak : 1;

  return (
    <div
      className="flex items-end gap-1.5 sm:gap-2"
      role="img"
      aria-label={`${history.name}, ${history.points.length} months`}
    >
      {history.points.map((point) => {
        const share = Math.max(0, point.total) / scale;
        return (
          <div
            key={point.monthKey}
            className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <span className="text-[0.65rem] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {point.empty ? "—" : formatMoney(point.total)}
            </span>
            <div className="flex h-32 w-full items-end sm:h-40">
              <div
                className={cn(
                  "w-full rounded-t transition-[height]",
                  point.empty && "border-t border-dashed border-border",
                )}
                style={{
                  height: point.empty ? 1 : `${Math.max(share * 100, 2)}%`,
                  backgroundColor: point.empty ? "transparent" : tone,
                }}
              />
            </div>
            <span className="truncate text-[0.65rem] text-muted-foreground">
              {point.shortLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CategoryHistoryView({
  histories,
  months,
}: CategoryHistoryViewProps) {
  const formatMoney = useFormatCurrency();
  const [selectedId, setSelectedId] = useState(histories[0]?.categoryId ?? "");

  const selected = useMemo(
    () => histories.find((h) => h.categoryId === selectedId) ?? histories[0],
    [histories, selectedId],
  );

  if (!selected) {
    return (
      <Card className="block w-full">
        <Card.Header>
          <Card.Title>Nothing to look back on yet</Card.Title>
          <Card.Description>
            Once a few months have transactions in them, each category&rsquo;s
            run will show up here.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  const rising = selected.trend !== null && selected.trend > 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="block w-full">
        <Card.Header>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <Card.Title>{selected.name}</Card.Title>
            <span className="text-sm text-muted-foreground">
              {CATEGORY_TYPE_LABELS[selected.type]} · last {months} months
            </span>
          </div>
          <Card.Description>
            <span className="tabular-nums">
              {formatMoney(selected.average)}
            </span>{" "}
            in a normal month
            {selected.trend !== null && (
              <>
                {" · "}
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    rising ? "text-destructive" : "text-success",
                  )}
                >
                  {rising ? <TrendUp size={13} /> : <TrendDown size={13} />}
                  {Math.abs(Math.round(selected.trend * 100))}%{" "}
                  {rising ? "above" : "below"} that this month
                </span>
              </>
            )}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Bars history={selected} />
        </Card.Content>
      </Card>

      <Card className="block w-full">
        <Card.Header>
          <Card.Title>Categories</Card.Title>
          <Card.Description>
            Busiest first. Pick one to see its months.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ul className="flex flex-col">
            {histories.map((history) => (
              <li key={history.categoryId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(history.categoryId)}
                  aria-current={history.categoryId === selected.categoryId}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-3",
                    "border-b border-border py-2 text-left last:border-0",
                    "transition-colors hover:text-primary-ink",
                    history.categoryId === selected.categoryId &&
                      "font-medium text-primary-ink",
                  )}
                >
                  <span className="min-w-0 truncate text-sm">
                    {history.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                    {formatMoney(history.average)} avg
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>
    </div>
  );
}
