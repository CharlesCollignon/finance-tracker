"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Fire } from "@phosphor-icons/react";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { describeDcaNeed, type DcaMonth } from "@finance/core/dca-need";
import { monthLong } from "@finance/core/i18n/calendar-names";
import type { FulfilmentProposal } from "@finance/core/recurring-fulfilment";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { useToast } from "@/components/layout/ToastProvider";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import moments from "@/components/motion/moments.module.css";
import { useMomentSeen } from "@/components/motion/use-moment-seen";
import { Button } from "@/components/ui/Button";
import { fulfilOccurrence } from "@/lib/actions/fulfilment";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/**
 * Le point's DCA card (`dcaMonth`): the month the transfer to the broker
 * pays for, from five days before its 1st — « À préparer pour novembre »,
 * then « envoyé ✓ » once the bank shows it — with the month's DCAs going
 * through one by one and the months funded in a row.
 *
 * When the bank has brought a movement that looks like the transfer, it is
 * confirmed here rather than in « C'est arrivé ? », which leaves it out.
 * Three moments, each once on this browser: the transfer sent, the month's
 * last DCA through, a run grown.
 */
export function DcaMonthCard({
  month: dca,
  proposal,
}: {
  month: DcaMonth;
  /** The bank's movement that looks like this transfer, if there is one. */
  proposal: FulfilmentProposal | null;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const [pending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  const monthKey = `${dca.need.year}-${String(dca.need.month).padStart(2, "0")}`;
  const name = monthLong(dca.need.month, locale);
  // At the head of a line: « Novembre · envoyé ».
  const Name = name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  const state = confirmed ? "sent" : dca.state;
  const allDone =
    dca.progress.total > 0 && dca.progress.done === dca.progress.total;
  const started = todayIsoLocal() >= `${monthKey}-01`;
  const due = formatShortDate(dca.occurredOn, locale);
  const overdue = dca.occurredOn < todayIsoLocal();

  const sentMoment = useMomentSeen(`dca-sent:${monthKey}`);
  const doneMoment = useMomentSeen(`dca-done:${monthKey}`);
  const runMoment = useMomentSeen(`dca-run:${dca.run}`);

  function confirm(of: FulfilmentProposal) {
    startTransition(async () => {
      const result = await fulfilOccurrence(
        of.templateId,
        of.occurredOn,
        of.transactionId,
      );
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setConfirmed(true);
    });
  }

  return (
    <section
      aria-label={t("dcaTransfer.headerTitle")}
      className="flex flex-col"
    >
      <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-4 py-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("dcaTransfer.headerTitle")}
        </h3>
        {dca.run >= 2 && runMoment.seen !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-medium text-primary",
              !runMoment.seen && moments.pop,
            )}
            onAnimationEnd={runMoment.seen ? undefined : runMoment.markSeen}
          >
            <Fire
              size={ICON.xs}
              weight="fill"
              aria-hidden
              className={moments.flame}
            />
            {t("dcaTransfer.run", { count: dca.run })}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {state === "sent" ? (
                <>
                  {t("dcaTransfer.sentFor", { month: Name })}
                  {sentMoment.seen !== null ? (
                    <CheckCircle
                      size={ICON.sm}
                      weight="fill"
                      aria-hidden
                      className={cn(
                        "text-success",
                        !sentMoment.seen && moments.pop,
                      )}
                      onAnimationEnd={
                        sentMoment.seen ? undefined : sentMoment.markSeen
                      }
                    />
                  ) : null}
                </>
              ) : state === "to-send" ? (
                t("dcaTransfer.prepareFor", { month: name })
              ) : (
                t("dcaTransfer.unseenFor", { month: Name })
              )}
            </p>
            {state !== "sent" ? (
              <p className="text-xs text-muted-foreground">
                {overdue
                  ? t("dcaTransfer.lateDue", { date: due })
                  : t("dcaTransfer.dueBy", { date: due })}
              </p>
            ) : null}
          </div>
          <AnimatedAmount
            value={dca.need.amount}
            format={formatMoney}
            startFrom={state === "to-send" ? 0 : undefined}
            className={cn(
              "font-head text-2xl font-semibold",
              TYPE_AMOUNT_CLASS.investment,
            )}
          />
        </div>

        <p className="privacy-sensitive text-xs text-muted-foreground">
          {describeDcaNeed(dca.need, t, locale)}
        </p>

        {proposal && !confirmed ? (
          <div className="flex flex-col gap-2 rounded-control border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              {t("dcaTransfer.bankSaw", {
                date: formatShortDate(proposal.actualOn, locale),
              })}{" "}
              <PrivateAmount className="font-medium tabular-nums">
                {formatMoney(proposal.actualAmount)}
              </PrivateAmount>
            </p>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => confirm(proposal)}
              className="shrink-0 gap-1.5 rounded-full"
            >
              <CheckCircle size={ICON.sm} weight="bold" />
              {t("dcaTransfer.confirm")}
            </Button>
          </div>
        ) : null}

        {started && dca.progress.total > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span
                className={cn(
                  "text-muted-foreground",
                  allDone && "font-medium text-foreground",
                  allDone &&
                    doneMoment.seen === false &&
                    cn("inline-block", moments.pop),
                )}
                onAnimationEnd={
                  allDone && doneMoment.seen === false
                    ? doneMoment.markSeen
                    : undefined
                }
              >
                {allDone
                  ? t("dcaTransfer.allDone", { month: name })
                  : t("dcaTransfer.progress", {
                      done: dca.progress.done,
                      total: dca.progress.total,
                      month: name,
                    })}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={dca.progress.total}
              aria-valuenow={dca.progress.done}
              aria-label={t("dcaTransfer.progress", {
                done: dca.progress.done,
                total: dca.progress.total,
                month: name,
              })}
            >
              <div
                className="h-full rounded-full bg-success transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{
                  width: `${Math.round((dca.progress.done / dca.progress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        <Link
          href="/recurring"
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 self-start rounded-full px-3 text-sm -ml-3",
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          )}
        >
          {t("dcaTransfer.open")}
          <ArrowRight size={ICON.sm} />
        </Link>
      </div>
    </section>
  );
}
