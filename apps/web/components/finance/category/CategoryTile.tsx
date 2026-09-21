"use client";

import {
  findingIsGoodNews,
  type CategoryFinding,
} from "@finance/core/category-findings";
import type {
  CategoryHistory,
  CategoryMonthPoint,
} from "@finance/core/category-history";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { PrivateAmount } from "@/components/layout/PrivateAmount";

export interface CategoryCard {
  history: CategoryHistory;
  normal: number;
  drawn: CategoryMonthPoint[];
  findings: CategoryFinding[];
}

/** Which chart token a category type is drawn in. */
export const TONE: Record<string, string> = {
  expense: "var(--chart-2)",
  income: "var(--chart-3)",
  savings: "var(--chart-4)",
  investment: "var(--chart-1)",
};

interface CategoryTileProps {
  card: CategoryCard;
  open: boolean;
  onOpen: (categoryId: string) => void;
  panelId: string;
}

/**
 * One category's run, small enough that twenty fit on a screen.
 *
 * Scaled against its own twelve months rather than against every category, so
 * what shows is the shape of this run and not the fact that the rent is
 * bigger than the coffee. Same argument `BarSeries` makes, applied to a tile.
 */
export function CategoryTile({
  card,
  open,
  onOpen,
  panelId,
}: CategoryTileProps) {
  const formatMoney = useFormatCurrency();
  const t = useT();
  const { history, normal, drawn, findings } = card;
  const peak = drawn.reduce((max, point) => Math.max(max, point.total), 0) || 1;
  const heaviest = findings[0] ?? null;
  // The same rule the band's rows follow, from the same function: what the
  // sign means comes from the category type, not from the sign.
  const heaviestIsGood = heaviest ? findingIsGoodNews(heaviest) : false;

  return (
    <button
      type="button"
      onClick={() => onOpen(history.categoryId)}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={t("categoryScreen.open", { name: history.name })}
      className={cn(
        "flex flex-col gap-1 rounded-card p-row border border-border text-left",
        "transition-colors hover:border-hairline-strong",
        open && "border-hairline-strong bg-muted/40",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">
          {history.name}
        </span>
        {heaviest ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
              heaviestIsGood
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive",
            )}
          >
            <PrivateAmount>{formatMoney(heaviest.severity)}</PrivateAmount>
          </span>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground">
        <PrivateAmount>{formatMoney(normal)}</PrivateAmount>
      </span>
      <span className="mt-1 flex h-10 items-end gap-0.5">
        {drawn.map((point) => (
          <span
            key={point.monthKey}
            className="flex-1"
            style={{
              height: point.empty
                ? "1px"
                : `${Math.max((point.total / peak) * 100, 2)}%`,
              backgroundColor: point.empty
                ? "var(--color-border)"
                : (TONE[history.type] ?? "var(--chart-1)"),
            }}
          />
        ))}
      </span>
    </button>
  );
}
