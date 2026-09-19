"use client";

import { useState } from "react";
import type { CategoryFinding } from "@finance/core/category-findings";
import { Card } from "@/components/retroui/Card";
import { useT } from "@/lib/locale-context";
import { CategoryGrid } from "./CategoryGrid";
import type { CategoryCard } from "./CategoryTile";

interface CategoryHistoryViewProps {
  cards: CategoryCard[];
  findings: CategoryFinding[];
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

  return (
    <div className="flex flex-col gap-6">
      <CategoryGrid
        cards={cards}
        openId={openId}
        onOpen={(id) => setOpenId((current) => (current === id ? null : id))}
        panel={null}
        panelId={PANEL_ID}
      />
    </div>
  );
}
