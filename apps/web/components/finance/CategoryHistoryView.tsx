"use client";

import { useMemo, useState } from "react";
import { Info, TrendDown, TrendUp } from "@phosphor-icons/react";
import type { CategoryHistory } from "@finance/core/category-history";
import { CATEGORY_TYPE_LABELS } from "@finance/core/category-styles";
import { BarSeries } from "@/components/finance/charts";
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
            {selected.periodShifted ? "per pay period" : "in a normal month"}
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
        <Card.Content className="flex flex-col gap-3">
          {/* Said out loud, because it is the one place in the app where a
              month means something different from what the Ledger means by
              it. Silently moving money between months is how an app ends up
              with two answers to the same question. */}
          {selected.periodShifted ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info size={13} className="mt-0.5 shrink-0" />
              These land either side of a month end, so each is counted against
              the period it belongs to. A month here can differ from the same
              month in the Ledger.
            </p>
          ) : null}
          <BarSeries
            color={TONE[selected.type] ?? "var(--chart-1)"}
            points={selected.points.map((point) => ({
              key: point.monthKey,
              label: point.shortLabel,
              value: point.total,
              empty: point.empty,
            }))}
          />
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
