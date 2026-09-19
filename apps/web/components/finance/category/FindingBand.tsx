"use client";

import type { CategoryFinding } from "@finance/core/category-findings";
import type { CategoryBreakdown } from "@finance/core/types/database";
import { SpendStrip } from "@/components/finance/charts";
import { Card } from "@/components/retroui/Card";
import { useT } from "@/lib/locale-context";
import { FindingRow } from "./FindingRow";

/** The most rows worth reading before a list becomes a page. */
export const MAX_FINDINGS_SHOWN = 5;

interface FindingBandProps {
  findings: CategoryFinding[];
  breakdown: CategoryBreakdown[];
  breakdownTotal: number;
  openId: string | null;
  onOpen: (categoryId: string) => void;
  panelId: string;
}

export function FindingBand({
  findings,
  breakdown,
  breakdownTotal,
  openId,
  onOpen,
  panelId,
}: FindingBandProps) {
  const t = useT();
  const shown = findings.slice(0, MAX_FINDINGS_SHOWN);

  return (
    <Card className="block w-full">
      <Card.Header>
        <Card.Title>{t("categoryFindings.bandTitle")}</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <SpendStrip rows={breakdown} total={breakdownTotal} />
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("categoryFindings.bandEmpty")}
          </p>
        ) : (
          <div className="flex flex-col">
            {shown.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                open={finding.categoryId === openId}
                onOpen={onOpen}
                panelId={panelId}
              />
            ))}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
