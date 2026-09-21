"use client";

import {
  findingIsGoodNews,
  type CategoryFinding,
} from "@finance/core/category-findings";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { useT } from "@/lib/locale-context";
import { PrivateAmount } from "@/components/layout/PrivateAmount";

interface FindingRowProps {
  finding: CategoryFinding;
  /**
   * A model's clause on why this one leads, when one was chosen and survived.
   *
   * It carries no figure — `verifyCategorySelection` drops any remark that
   * writes one, for the same reason the sentence beside it carries none: a
   * figure inside prose cannot be blurred by privacy mode and cannot follow
   * the currency toggle.
   */
  remark?: string;
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
  remark,
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
  // Never off `direction` alone. A salary that has stopped arriving points
  // down, and down is not good news on money coming in — see
  // `findingIsGoodNews`, which is where the category type gets its say.
  const good = findingIsGoodNews(finding);

  return (
    <button
      type="button"
      onClick={() => onOpen(finding.categoryId)}
      aria-expanded={open}
      aria-controls={panelId}
      className={cn(
        "flex w-full items-baseline gap-3 border-b border-border py-2.5",
        // A wash rather than a colour on the words. The row's name is already
        // set in the foreground, so tinting it gold was the only way the old
        // hover showed at all — and the List Rows rule in DESIGN.md wants the
        // wash anyway.
        "text-left last:border-0 transition-colors hover:bg-muted/40",
      )}
    >
      <span className="shrink-0 text-sm font-medium">
        {finding.categoryName}
      </span>
      <span className="min-w-0 flex-1 text-sm text-muted-foreground">
        {t(finding.messageKey, finding.params)}
        {remark ? (
          // Inherits the muted foreground of the sentence it hangs under. It
          // carried `text-muted-foreground/80`, a further step down on top of
          // that — an alpha literal where a token exists, and at 12px italic
          // the one line here least able to afford it. The italic and the
          // size are what make it an aside.
          <span className="block text-xs italic">{remark}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          good ? "text-success" : "text-destructive",
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
