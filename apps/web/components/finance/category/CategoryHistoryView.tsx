"use client";

import { useState } from "react";
import type { CategoryFacts } from "@finance/core/category-facts";
import type { CategoryRead as CategoryReadValue } from "@finance/core/category-read";
import type { CategoryFinding } from "@finance/core/category-findings";
import type { Locale } from "@finance/core/i18n/locale";
import type { CategoryBreakdown } from "@finance/core/types/database";
import { Card } from "@/components/retroui/Card";
import { useT } from "@/lib/locale-context";
import { CategoryGrid } from "./CategoryGrid";
import { FindingBand } from "./FindingBand";
import { CategoryPanel, type PanelTransaction } from "./CategoryPanel";
import type { CategoryCard } from "./CategoryTile";

interface CategoryHistoryViewProps {
  cards: CategoryCard[];
  /** Already in the order the band should read, app's or model's. */
  findings: CategoryFinding[];
  /** A model's remark per finding id, where one survived and applies. */
  remarks: Record<string, string>;
  /** Whose order the band is showing, and whether a stored one was refused. */
  rerankState: "none" | "applied" | "stale";
  /** False with no model key, or before migration 035: no button at all. */
  rerankConfigured: boolean;
  rerankWritesLeft: number;
  breakdown: CategoryBreakdown[];
  breakdownTotal: number;
  /** The transactions behind the month each category's findings point at. */
  behind: Record<string, PanelTransaction[]>;
  /** Same target month as `behind`, as `YYYY-MM`. */
  behindMonth: Record<string, string>;
  /** Same target month as `behind`, as a label. */
  behindMonthLabel: Record<string, string>;
  /** A category read, per category id. Null where nothing has been written. */
  reads: Record<string, CategoryReadValue | null>;
  /** The current figures behind each read, labelled in its own language. */
  readFacts: Record<string, CategoryFacts | null>;
  readLocale: Record<string, Locale>;
  /** Too little recorded to be worth a read; the writer is not offered. */
  readThin: Record<string, boolean>;
  /** The shared, cross-category allowance — the same number everywhere. */
  readWritesLeft: number;
  readConfigured: boolean;
}

const PANEL_ID = "category-panel";

/**
 * The by-category screen: what moved, every run at once, and one open panel.
 *
 * Holds one piece of layout state — which category is open — and nothing
 * else. The buttons that ask a model — the panel's writer and the band's
 * re-rank — keep their own pending state, as `MonthRead` does.
 */
export function CategoryHistoryView({
  cards,
  findings,
  remarks,
  rerankState,
  rerankConfigured,
  rerankWritesLeft,
  breakdown,
  breakdownTotal,
  behind,
  behindMonth,
  behindMonthLabel,
  reads,
  readFacts,
  readLocale,
  readThin,
  readWritesLeft,
  readConfigured,
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
        remarks={remarks}
        rerankState={rerankState}
        rerankConfigured={rerankConfigured}
        rerankWritesLeft={rerankWritesLeft}
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
              read={reads[openCard.history.categoryId] ?? null}
              readFacts={readFacts[openCard.history.categoryId] ?? null}
              readLocale={readLocale[openCard.history.categoryId] ?? "en"}
              readThin={readThin[openCard.history.categoryId] ?? true}
              readWritesLeft={readWritesLeft}
              readConfigured={readConfigured}
            />
          ) : null
        }
        panelId={PANEL_ID}
      />
    </div>
  );
}
