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
 * Whether the weight is stated as a rate follows how `severity` was computed,
 * not the label: a rate is only honest for a species whose severity is
 * itself a sustained monthly figure.
 */
export function FindingRow({
  finding,
  open,
  onOpen,
  panelId,
}: FindingRowProps) {
  const formatMoney = useFormatCurrency();
  const t = useT();
  // Only these two compute `severity` as a monthly rate:
  //   drift       — the size of a shift sustained across three months.
  //   gone-quiet  — the median of what used to (or now does) arrive monthly.
  // `odd-month` and `every-year` both compute `severity` as one month's
  // distance from normal — a one-off, worth its size once, not "a month".
  // Listed positively so a future species has to be placed deliberately
  // rather than inheriting "rate" by default.
  const perMonth = finding.kind === "drift" || finding.kind === "gone-quiet";

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
