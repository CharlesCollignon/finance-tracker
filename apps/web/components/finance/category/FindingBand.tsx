"use client";

import { useState, useTransition } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import type { CategoryFinding } from "@finance/core/category-findings";
import type { CategoryBreakdown } from "@finance/core/types/database";
import { SpendStrip } from "@/components/finance/charts";
import { Card } from "@/components/retroui/Card";
import { useToast } from "@/components/layout/ToastProvider";
import { rerankFindingsAction } from "@/lib/actions/category-read";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { FindingRow } from "./FindingRow";

/** The most rows worth reading before a list becomes a page. */
export const MAX_FINDINGS_SHOWN = 5;

interface FindingBandProps {
  /** Already in the order to read them in — the app's, or a model's. */
  findings: CategoryFinding[];
  /** A model's remark per finding id, where one survived and applies. */
  remarks: Record<string, string>;
  /** Whose order this is showing, and whether a stored one was refused. */
  rerankState: "none" | "applied" | "stale";
  /** False with no model key, or before migration 035: no button at all. */
  rerankConfigured: boolean;
  rerankWritesLeft: number;
  breakdown: CategoryBreakdown[];
  breakdownTotal: number;
  openId: string | null;
  onOpen: (categoryId: string) => void;
  panelId: string;
}

/**
 * What moved, in the order worth reading it in.
 *
 * That order is the app's own — weight in currency units a month, heaviest
 * first — and it leads until somebody asks for another. There is no automatic
 * call: a quiet button asks, and a deployment with no model key renders this
 * band exactly as it did before the button existed, with no control that does
 * nothing.
 *
 * The ordering itself happens on the server, in `history/page.tsx`, along
 * with the decision about whether a stored order still describes the figures
 * under it. This component is handed the answer.
 */
export function FindingBand({
  findings,
  remarks,
  rerankState,
  rerankConfigured,
  rerankWritesLeft,
  breakdown,
  breakdownTotal,
  openId,
  onOpen,
  panelId,
}: FindingBandProps) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState(rerankWritesLeft);
  const shown = findings.slice(0, MAX_FINDINGS_SHOWN);

  function rerank() {
    startTransition(async () => {
      const outcome = await rerankFindingsAction();
      setLeft(outcome.writesLeft);
      if (outcome.message) {
        toast(outcome.message, "error");
      }
    });
  }

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
                remark={remarks[finding.id]}
                open={finding.categoryId === openId}
                onOpen={onOpen}
                panelId={panelId}
              />
            ))}
          </div>
        )}

        {/*
         * The footer exists only when it has something in it. With no model
         * key and no stored order, nothing below the rows is rendered at all
         * — not an empty row, not a border.
         */}
        {rerankState !== "none" || rerankConfigured ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
            <p className="text-xs text-muted-foreground">
              {rerankState === "applied"
                ? t("categoryFindings.reranked")
                : rerankState === "stale"
                  ? t("categoryFindings.rerankStale")
                  : null}
            </p>

            {rerankConfigured ? (
              <button
                type="button"
                onClick={rerank}
                disabled={pending || left <= 0}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3",
                  "text-sm font-medium transition-colors",
                  left > 0
                    ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                    : "cursor-not-allowed text-muted-foreground",
                  "disabled:opacity-60",
                )}
              >
                <PencilSimple size={ICON.sm} />
                {pending
                  ? t("categoryRead.writing")
                  : left <= 0
                    ? t("categoryRead.noReadsLeft")
                    : t("categoryFindings.rerank")}
              </button>
            ) : null}
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}
