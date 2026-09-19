"use client";

import type { CategoryFinding } from "@finance/core/category-findings";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { PrivateAmount } from "@/components/layout/PrivateAmount";

interface FindingRowProps {
  finding: CategoryFinding;
  open: boolean;
  onOpen: (categoryId: string) => void;
  panelId: string;
}

/**
 * One finding: the category, what it did, and what that is worth.
 *
 * The sentence holds no amount. A figure inside prose cannot be blurred by
 * privacy mode and cannot follow the currency toggle — the same argument
 * `month-facts.ts` makes for placeholders — so the weight sits beside it in
 * an element of its own.
 *
 * `gone-quiet` and `every-year` are stated as a rate only when a rate is what
 * they mean; a one-off odd month is worth its distance from normal, once.
 */
export function FindingRow({
  finding,
  open,
  onOpen,
  panelId,
}: FindingRowProps) {
  const formatMoney = useFormatCurrency();
  const t = useT();
  const perMonth = finding.kind !== "odd-month";

  return (
    <button
      type="button"
      onClick={() => onOpen(finding.categoryId)}
      aria-expanded={open}
      aria-controls={panelId}
      className={cn(
        "flex w-full items-baseline gap-3 border-b border-border py-2.5",
        "text-left last:border-0 transition-colors hover:text-primary-ink",
      )}
    >
      <span className="shrink-0 text-sm font-medium">
        {finding.categoryName}
      </span>
      <span className="min-w-0 flex-1 text-sm text-muted-foreground">
        {t(finding.messageKey, finding.params)}
      </span>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          finding.direction === "up" ? "text-destructive" : "text-success",
        )}
      >
        <PrivateAmount>
          {t(
            perMonth
              ? "categoryFindings.weightPerMonth"
              : "categoryFindings.weightOnce",
            { amount: formatMoney(finding.severity) },
          )}
        </PrivateAmount>
      </span>
    </button>
  );
}
