"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { PlannedOccurrence } from "@finance/core/apply-recurring";
import { formatShortDate } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { resolveMessage } from "@finance/core/i18n/t";
import { Button, buttonVariants } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { amountSign } from "@finance/core/amount-sign";
import {
  describeMiss,
  type FulfilmentMiss,
} from "@finance/core/recurring-fulfilment";
import { explainAwaitedOccurrence } from "@/lib/actions/fulfilment";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { useToast } from "@/components/layout/ToastProvider";
import {
  recordPlannedNow,
  skipPlannedOccurrence,
  undoRecordPlanned,
  unskipRecurringOccurrence,
} from "@/lib/actions/finance";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

interface PlannedOccurrenceSheetProps {
  /** The occurrence tapped, or null while closed. */
  occurrence: PlannedOccurrence | null;
  onOpenChange: (open: boolean) => void;
  /**
   * Whether it falls in the month in progress. Recording one early only makes
   * sense for this month: next month's rent has not arrived in September.
   */
  inCurrentMonth: boolean;
}

/**
 * One planned occurrence, opened: the three things that can be done about a
 * charge that has not come yet.
 *
 * It already happened, so record it now. It will not happen this time, so
 * skip it. Or it is the charge that is wrong, so go and edit that — the one
 * place where a change reaches every month ahead at once. Each of the first
 * two can be taken back from the toast that reports it, because neither is
 * visible anywhere afterwards except as a row that stopped being planned.
 */
export function PlannedOccurrenceSheet({
  occurrence,
  onOpenChange,
  inCurrentMonth,
}: PlannedOccurrenceSheetProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  // Why the bank has not brought it, asked when the sheet opens on one it
  // still owes. Kept with the occurrence it answers, so another one opened
  // next never shows the last one's reason.
  const [why, setWhy] = useState<{
    key: string;
    miss: FulfilmentMiss | null;
  } | null>(null);
  const awaitedKey = occurrence?.awaited
    ? `${occurrence.templateId}:${occurrence.occurredOn}`
    : null;

  useEffect(() => {
    if (!awaitedKey || !occurrence) {
      return;
    }
    let live = true;
    void explainAwaitedOccurrence(
      occurrence.templateId,
      occurrence.occurredOn,
    ).then((result) => {
      if (live && result.success) {
        setWhy({ key: awaitedKey, miss: result.miss });
      }
    });
    return () => {
      live = false;
    };
    // The key names the occurrence; the object is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitedKey]);

  if (!occurrence) {
    return null;
  }
  const miss = why && why.key === awaitedKey ? why.miss : null;

  const date = formatShortDate(occurrence.occurredOn, locale);
  const { templateId, occurredOn } = occurrence;

  function report(error: string | undefined) {
    toast(resolveMessage(t, error ?? ""), "error");
  }

  function recordNow() {
    startTransition(async () => {
      const result = await recordPlannedNow(templateId, occurredOn);
      if (result.error || !result.transactionId) {
        report(result.error);
        return;
      }
      const transactionId = result.transactionId;
      onOpenChange(false);
      toast({
        title: t("planned.recorded"),
        variant: "success",
        actionLabel: t("planned.undo"),
        onAction: () => {
          void undoRecordPlanned(transactionId, templateId, occurredOn);
        },
      });
    });
  }

  function skip() {
    startTransition(async () => {
      const result = await skipPlannedOccurrence(templateId, occurredOn);
      if (result.error) {
        report(result.error);
        return;
      }
      onOpenChange(false);
      toast({
        title: t("planned.skipped", { date }),
        variant: "success",
        actionLabel: t("planned.undo"),
        onAction: () => {
          void unskipRecurringOccurrence(templateId, occurredOn);
        },
      });
    });
  }

  return (
    <MobileSheet open onOpenChange={onOpenChange} title={occurrence.name}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <CategoryIcon
              icon={occurrence.categoryIcon}
              className="size-9 shrink-0 rounded-control border border-dashed border-hairline-strong bg-transparent"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {occurrence.categoryName}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t(
                  occurrence.awaited ? "planned.awaitedBody" : "planned.body",
                  { date },
                )}
              </span>
              {miss ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t("planned.why", {
                    reason: describeMiss(miss, formatEuro, locale),
                  })}
                </span>
              ) : null}
            </span>
          </span>
          <span
            className={cn(
              "privacy-amount shrink-0 text-base font-semibold tabular-nums",
              TYPE_AMOUNT_CLASS[occurrence.categoryType],
            )}
          >
            {amountSign(occurrence.categoryType)}
            {formatEuro(occurrence.amount)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {/* One the bank still owes is recorded by the bank. */}
          {inCurrentMonth && !occurrence.awaited ? (
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={pending}
                onClick={recordNow}
              >
                {t("planned.recordNow")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t("planned.recordNowHint")}
              </p>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={pending}
            onClick={skip}
          >
            {t("planned.skip")}
          </Button>
          <Link
            href={`/recurring?edit=${templateId}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "w-full",
            )}
          >
            {t("planned.editCharge")}
          </Link>
        </div>
      </div>
    </MobileSheet>
  );
}
