"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check } from "@phosphor-icons/react";
import type { ApplyRecurringPlan } from "@finance/core/apply-recurring";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { ApplyRecurringSheet } from "@/components/finance/ApplyRecurringSheet";
import { useToast } from "@/components/layout/ToastProvider";
import { applyRecurringForMonth } from "@/lib/actions/finance";
import { useFormatCurrency } from "@/lib/use-currency";

interface MonthReadyCardProps {
  monthLabel: string;
  year: number;
  month: number;
  plan: ApplyRecurringPlan;
}

/**
 * The month's opening moment.
 *
 * Applying recurring templates is the single action that produces most of the
 * ledger — the payoff for all the template setup — and it used to be a small
 * outline button wedged between a search field and a list, marked with a red
 * dot, which reads as a pending chore rather than the good part. Here it is
 * the first thing on the screen when there is something to apply, and it
 * disappears entirely once there is not.
 */
export function MonthReadyCard({
  monthLabel,
  year,
  month,
  plan,
}: MonthReadyCardProps) {
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const creates = plan.toCreate.length;
  const updates = plan.toUpdate.length;

  if (creates === 0 && updates === 0) {
    return null;
  }

  const total = plan.toCreate.reduce((sum, item) => sum + item.amount, 0);

  function apply(includeUpdates: boolean, selectedKeys?: string[]) {
    startTransition(async () => {
      const result = await applyRecurringForMonth(
        year,
        month,
        includeUpdates,
        selectedKeys,
      );

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      setReviewOpen(false);
      toast(
        result.created
          ? `${result.created} added to ${monthLabel}`
          : "Recurring applied",
        "success",
      );
    });
  }

  const headline =
    creates > 0
      ? `Your ${monthLabel} is ready`
      : `${monthLabel} needs an update`;

  const detail =
    creates > 0
      ? `${creates} recurring ${creates === 1 ? "item" : "items"} · ${formatEuro(total)}`
      : `${updates} ${updates === 1 ? "entry has" : "entries have"} changed since you applied.`;

  return (
    <>
      <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="font-head text-lg">{headline}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
            {creates > 0 && updates > 0 ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {updates} existing {updates === 1 ? "entry" : "entries"} also
                changed.
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setReviewOpen(true)}
              disabled={pending}
            >
              Review
            </Button>
            <Button
              variant="pill"
              className="gap-3"
              disabled={pending}
              onClick={() => apply(updates > 0)}
            >
              {pending ? "Applying…" : "Apply"}
              <ButtonNub>
                {pending ? <Check size={16} /> : <ArrowRight size={16} />}
              </ButtonNub>
            </Button>
          </div>
        </div>
      </Card.Bezel>

      <ApplyRecurringSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        plan={plan}
        pending={pending}
        onConfirm={(includeUpdates, selectedKeys) =>
          apply(includeUpdates, selectedKeys)
        }
      />
    </>
  );
}
