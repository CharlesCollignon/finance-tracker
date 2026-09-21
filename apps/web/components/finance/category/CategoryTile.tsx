"use client";

import { ALLOCATION_COLORS } from "@finance/core/category-styles";
import {
  findingIsGoodNews,
  type CategoryFinding,
} from "@finance/core/category-findings";
import type { CategoryType } from "@finance/core/types/database";
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

/**
 * Which colour a category type is drawn in.
 *
 * Read off `ALLOCATION_COLORS` rather than stated a second time. This map
 * used to point the four types at `--chart-2 / --chart-3 / --chart-4 /
 * --chart-1`, which is the neutral series palette — so on the Categories
 * screen a savings run was drawn in the chart cyan while every savings amount
 * elsewhere in the app is gold, and DESIGN.md's "the same mapping drives
 * allocation charts, so a slice and a row agree about what a category is" was
 * false on the one screen that looks at a single category at a time.
 *
 * The keys have to be rewritten because `ALLOCATION_COLORS` names the flows
 * of the allocation Sankey — `expenses`, `investments` — and this names the
 * four `CategoryType` values. That rewrite is the whole of this map: no
 * colour is chosen here, which is the point.
 *
 * Savings landing on `--primary` is the Rare Accent Rule's fourth home, not a
 * fifth: gold is "systematically, a savings amount", and a bar whose height
 * is a month of savings is that amount drawn rather than set. The Sankey has
 * painted the savings flow gold from the same constant all along.
 *
 * The chart palette keeps the job it is good at — telling unlike things apart
 * in one series, as the wallets and the look-through do. Four bands that each
 * already *mean* income or expense are not that.
 */
export const TONE: Record<CategoryType, string> = {
  income: ALLOCATION_COLORS.income,
  expense: ALLOCATION_COLORS.expenses,
  savings: ALLOCATION_COLORS.savings,
  investment: ALLOCATION_COLORS.investments,
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
                : TONE[history.type],
            }}
          />
        ))}
      </span>
    </button>
  );
}
