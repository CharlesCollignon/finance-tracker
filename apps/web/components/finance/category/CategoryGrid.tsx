"use client";

import { Fragment } from "react";
import type { CategoryType } from "@finance/core/types/database";
import type { Key } from "@finance/core/i18n/t";
import { CategoryTile, type CategoryCard } from "./CategoryTile";
import { useT } from "@/lib/locale-context";

interface CategoryGridProps {
  cards: CategoryCard[];
  openId: string | null;
  onOpen: (categoryId: string) => void;
  /** Rendered full width, immediately after the open tile. */
  panel: React.ReactNode;
  panelId: string;
}

/**
 * The four groups, in the order money moves through them.
 *
 * Grouped rather than filtered: no control, no state, and a salary cannot end
 * up sitting between two spending categories.
 */
const GROUPS: { type: CategoryType; labelKey: Key }[] = [
  { type: "expense", labelKey: "categoryScreen.groupExpense" },
  { type: "income", labelKey: "categoryScreen.groupIncome" },
  { type: "savings", labelKey: "categoryScreen.groupSavings" },
  { type: "investment", labelKey: "categoryScreen.groupInvestment" },
];

/**
 * Every category at once, and the panel that opens inside it.
 *
 * Deliberately not `grid-auto-flow: dense`. The Bearing's grid needs dense
 * backfill because its tiles have different spans, and `bearing-grid.ts`
 * records what that cost: a full-width panel inserted mid-row made the tiles
 * after it flow into the gap, and the arithmetic written to avoid that
 * shipped wrong. These tiles are all one column, so ordinary flow puts the
 * panel on the next row by itself and nothing backfills. The gap left at the
 * end of the row above is honest: it shows where you opened.
 */
export function CategoryGrid({
  cards,
  openId,
  onOpen,
  panel,
  panelId,
}: CategoryGridProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map(({ type, labelKey }) => {
        const group = cards.filter((card) => card.history.type === type);
        if (group.length === 0) {
          return null;
        }
        return (
          <section key={type} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(labelKey)}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {group.map((card) => (
                <Fragment key={card.history.categoryId}>
                  <CategoryTile
                    card={card}
                    open={card.history.categoryId === openId}
                    onOpen={onOpen}
                    panelId={panelId}
                  />
                  {card.history.categoryId === openId ? (
                    <div className="col-span-full">{panel}</div>
                  ) : null}
                </Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
