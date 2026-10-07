"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CaretDown,
  CheckCircle,
  CoinVertical,
  Fire,
} from "@phosphor-icons/react";
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

/** Past this many DCAs a month, dots would crowd the line: a count instead. */
const MAX_DOTS = 10;

/**
 * The transfer to the broker, as one line under Le point's chart
 * (`dcaMonth`): a coin, the month, its figure, where it stands, and a dot per
 * DCA of the month, filled as each goes through. Pressed, it unfolds what the
 * figure is made of and when it is due; it opens on its own when the bank has
 * brought a movement that looks like the transfer, to be confirmed here
 * (and so not in « C'est arrivé ? »).
 *
 * Alive without asking for attention: the coin gives a small shake every few
 * seconds while the transfer is to send, and three moments pop once on this
 * browser — the transfer sent, the month's last DCA through, a run grown.
 */
export function DcaStrip({
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
  const [open, setOpen] = useState(false);

  const monthKey = `${dca.need.year}-${String(dca.need.month).padStart(2, "0")}`;
  const name = monthLong(dca.need.month, locale);
  // At the head of the line: « Novembre ».
  const Name = name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  const state = confirmed ? "sent" : dca.state;
  const asking = proposal !== null && !confirmed;
  const unfolded = open || asking;
  const today = todayIsoLocal();
  const started = today >= `${monthKey}-01`;
  const { done, total } = dca.progress;
  const allDone = total > 0 && done === total;
  const due = formatShortDate(dca.occurredOn, locale);
  const progressLabel = t("dcaTransfer.progress", { done, total, month: name });

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
    <div className="rounded-control border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={unfolded}
        aria-label={`${t("dcaTransfer.headerTitle")} · ${Name}`}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-control"
      >
        <CoinVertical
          size={ICON.md}
          weight="duotone"
          aria-hidden
          className={cn(
            "shrink-0 text-primary",
            state === "to-send" && moments.wiggle,
          )}
        />
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
          <span className="font-medium">{Name}</span>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <AnimatedAmount
            value={dca.need.amount}
            format={formatMoney}
            startFrom={state === "to-send" ? 0 : undefined}
            className={cn("font-semibold", TYPE_AMOUNT_CLASS.investment)}
          />
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            {state === "sent"
              ? t("dcaTransfer.stripSent")
              : state === "to-send"
                ? t("dcaTransfer.stripToSend")
                : t("dcaTransfer.stripUnseen")}
            {state === "sent" && sentMoment.seen !== null ? (
              <CheckCircle
                size={ICON.sm}
                weight="fill"
                aria-hidden
                className={cn("text-success", !sentMoment.seen && moments.pop)}
                onAnimationEnd={
                  sentMoment.seen ? undefined : sentMoment.markSeen
                }
              />
            ) : null}
          </span>
        </span>

        {started && total > 0 ? (
          total <= MAX_DOTS ? (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1",
                allDone && doneMoment.seen === false && moments.pop,
              )}
              onAnimationEnd={
                allDone && doneMoment.seen === false
                  ? doneMoment.markSeen
                  : undefined
              }
              aria-label={progressLabel}
              role="img"
            >
              {Array.from({ length: total }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "size-1.5 rounded-full transition-colors duration-500",
                    index < done ? "bg-success" : "bg-foreground/15",
                  )}
                />
              ))}
            </span>
          ) : (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {done}/{total}
            </span>
          )
        ) : null}

        {dca.run >= 2 && runMoment.seen !== null ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary",
              !runMoment.seen && moments.pop,
            )}
            onAnimationEnd={runMoment.seen ? undefined : runMoment.markSeen}
            title={t("dcaTransfer.run", { count: dca.run })}
          >
            <Fire size={ICON.xs} weight="fill" className={moments.flame} />
            {dca.run}
          </span>
        ) : null}

        <CaretDown
          size={ICON.sm}
          aria-hidden
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-200",
            unfolded && "rotate-180",
          )}
        />
      </button>

      {unfolded ? (
        <div className="flex flex-col gap-2.5 border-t border-border px-3 py-3 text-xs">
          <p className="privacy-sensitive text-muted-foreground">
            {describeDcaNeed(dca.need, t, locale)}
          </p>
          {state !== "sent" ? (
            <p className="text-muted-foreground">
              {dca.occurredOn < today
                ? t("dcaTransfer.lateDue", { date: due })
                : t("dcaTransfer.dueBy", { date: due })}
            </p>
          ) : null}

          {asking ? (
            <div className="flex flex-col gap-2 rounded-control border border-border bg-background/40 p-2.5 sm:flex-row sm:items-center sm:justify-between">
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

          {started && total > 0 ? (
            <p
              className={
                allDone
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {allDone
                ? t("dcaTransfer.allDone", { month: name })
                : progressLabel}
              {dca.run >= 2
                ? ` · ${t("dcaTransfer.run", { count: dca.run })}`
                : ""}
            </p>
          ) : null}

          <Link
            href="/recurring"
            className="inline-flex items-center gap-1 self-start text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t("dcaTransfer.open")}
            <ArrowRight size={ICON.xs} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
