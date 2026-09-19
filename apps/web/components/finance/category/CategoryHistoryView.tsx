"use client";

import { useState } from "react";
import type { CategoryFinding } from "@finance/core/category-findings";
import type { CategoryBreakdown } from "@finance/core/types/database";
import { Card } from "@/components/retroui/Card";
import { useT } from "@/lib/locale-context";
import { CategoryGrid } from "./CategoryGrid";
import { FindingBand } from "./FindingBand";
import { CategoryPanel, type PanelTransaction } from "./CategoryPanel";
import type { CategoryCard } from "./CategoryTile";

interface CategoryHistoryViewProps {
  cards: CategoryCard[];
  findings: CategoryFinding[];
  breakdown: CategoryBreakdown[];
  breakdownTotal: number;
  /** The transactions behind the month each category's findings point at. */
  behind: Record<string, PanelTransaction[]>;
  /** Same target month as `behind`, as `YYYY-MM`. */
  behindMonth: Record<string, string>;
  /** Same target month as `behind`, as a label. */
  behindMonthLabel: Record<string, string>;
}

const PANEL_ID = "category-panel";

/**
 * The by-category screen: what moved, every run at once, and one open panel.
 *
 * Holds one piece of layout state — which category is open — and nothing
 * else. The two buttons that ask a model keep their own pending state, as
 * `MonthRead` does.
 */
export function CategoryHistoryView({
  cards,
  findings,
  breakdown,
  breakdownTotal,
  behind,
  behindMonth,
  behindMonthLabel,
}: CategoryHistoryViewProps) {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <Card className="block w-full">
        <Card.Header>
          <Card.Title>{t("categoryScreen.empty")}</Card.Title>
          <Card.Description>{t("categoryScreen.emptyBody")}</Card.Description>
        </Card.Header>
      </Card>
    );
  }

  const toggle = (id: string) =>
    setOpenId((current) => (current === id ? null : id));

  const openCard = cards.find((card) => card.history.categoryId === openId);

  return (
    <div className="flex flex-col gap-6">
      <FindingBand
        findings={findings}
        breakdown={breakdown}
        breakdownTotal={breakdownTotal}
        openId={openId}
        onOpen={toggle}
        panelId={PANEL_ID}
      />
      <CategoryGrid
        cards={cards}
        openId={openId}
        onOpen={toggle}
        panel={
          openCard ? (
            <CategoryPanel
              id={PANEL_ID}
              card={openCard}
              behind={behind[openCard.history.categoryId] ?? []}
              behindMonthKey={behindMonth[openCard.history.categoryId] ?? ""}
              behindMonthLabel={
                behindMonthLabel[openCard.history.categoryId] ?? ""
              }
              onClose={() => setOpenId(null)}
            />
          ) : null
        }
        panelId={PANEL_ID}
      />
    </div>
  );
}
