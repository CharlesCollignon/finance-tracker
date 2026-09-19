"use client";

import { useState } from "react";
import type { CategoryFinding } from "@finance/core/category-findings";
import type { CategoryBreakdown } from "@finance/core/types/database";
import { Card } from "@/components/retroui/Card";
import { useT } from "@/lib/locale-context";
import { CategoryGrid } from "./CategoryGrid";
import { FindingBand } from "./FindingBand";
import type { CategoryCard } from "./CategoryTile";

interface CategoryHistoryViewProps {
  cards: CategoryCard[];
  findings: CategoryFinding[];
  breakdown: CategoryBreakdown[];
  breakdownTotal: number;
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
        panel={null}
        panelId={PANEL_ID}
      />
    </div>
  );
}
