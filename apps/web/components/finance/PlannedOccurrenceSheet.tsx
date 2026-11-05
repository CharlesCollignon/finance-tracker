"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { PlannedOccurrence } from "@finance/core/apply-recurring";
import { formatShortDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { Button, buttonVariants } from "@/components/ui/Button";
import { CategoryGlyph } from "@/components/finance/CategoryIcon";
import { KIND_INK } from "@/components/finance/add/parts";
import {
  SheetGlow,
  SheetSave,
  SheetValue,
} from "@/components/finance/sheet/entry-sheet";
import { ICON } from "@/lib/icon-scale";
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
      <div className="relative -mx-4 -mt-4 h-0 md:-mx-5 md:-mt-5">
        <SheetGlow ink={KIND_INK[occurrence.categoryType]} />
      </div>
      <div className="relative flex flex-col gap-5">
        <SheetValue
          value={`${amountSign(occurrence.categoryType)}${formatEuro(occurrence.amount)}`}
          ink={KIND_INK[occurrence.categoryType]}
          caption={t(
            occurrence.awaited ? "planned.awaitedBody" : "planned.body",
            { date },
          )}
        />
        {/* Dashed, as on the phone: a thing expected, not a thing done. */}
        <div className="-mt-3 flex flex-col items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-dashed border-hairline-strong py-1 pl-1 pr-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-foreground/5">
              <CategoryGlyph icon={occurrence.categoryIcon} size={ICON.md} />
            </span>
            <span className="truncate text-sm font-medium">
              {occurrence.categoryName}
            </span>
          </span>
          {miss ? (
            <p className="text-center text-xs text-muted-foreground">
              {t("planned.why", {
                reason: describeMiss(miss, formatEuro, locale),
              })}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {/* One the bank still owes is recorded by the bank. */}
          {inCurrentMonth && !occurrence.awaited ? (
            <div className="flex flex-col gap-1.5">
              <SheetSave
                type="button"
                label={t("planned.recordNow")}
                disabled={pending}
                onClick={recordNow}
              />
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
