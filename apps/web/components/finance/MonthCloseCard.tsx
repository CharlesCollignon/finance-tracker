"use client";

import { useState } from "react";
import { ArrowRight, Flame } from "@phosphor-icons/react";
import { closeInvitation } from "@finance/core/month-close";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { MonthCloseSheet } from "@/components/finance/MonthCloseSheet";
import { useFormatCurrency } from "@/lib/use-currency";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

interface MonthCloseCardProps {
  year: number;
  month: number;
  monthLabel: string;
  observeOn: string;
  isBaseline: boolean;
  monthlyCommitted: number;
  unrecordedCap: number | null;
  baseline: number | null;
  streak: number;
}

/**
 * The month's closing moment.
 *
 * It shuts a month, and is the only place the app asks for something it
 * cannot work out for itself. One number, once a month, in exchange for the
 * only honest answer to "did I actually save anything" — so it is worth a
 * card rather than a setting buried on a screen nobody visits.
 *
 * Which of the four invitations it opens with is `closeInvitation`'s decision
 * and not this card's, the same way the phone's Plan tab asks. The three
 * conditionals that used to be written out here chose between four English
 * sentences built with template literals, so the card was the one surface in
 * the app that could not be read in French at all.
 */
export function MonthCloseCard({
  year,
  month,
  monthLabel,
  observeOn,
  isBaseline,
  monthlyCommitted,
  unrecordedCap,
  baseline,
  streak,
}: MonthCloseCardProps) {
  const t = useT();
  const formatMoney = useFormatCurrency();
  const [open, setOpen] = useState(false);

  const invitation = closeInvitation({ isBaseline, unrecordedCap, baseline });
  const detail =
    invitation.kind === "baseline"
      ? t("monthClose.inviteBaseline")
      : invitation.kind === "allowance"
        ? t("monthClose.inviteAllowance", { cap: formatMoney(invitation.cap) })
        : invitation.kind === "normal"
          ? t("monthClose.inviteNormal", {
              amount: formatMoney(invitation.baseline),
            })
          : t("monthClose.inviteBare");
  // Two of the four invitations name a figure of the user's own — their
  // allowance, or what a normal month has cost them. The other two only say
  // what closing is for.
  const detailHasAmount =
    invitation.kind === "allowance" || invitation.kind === "normal";

  return (
    <>
      <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-head text-lg">
                {isBaseline
                  ? t("monthClose.setStartingBalance")
                  : t("month.attentionReadyToClose", { month: monthLabel })}
              </h2>
              {streak > 1 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
                  title={t("monthClose.monthsInARow", { count: streak })}
                >
                  <Flame size={ICON.xs} weight="fill" />
                  {streak}
                </span>
              )}
            </div>
            <p
              className={cn(
                "mt-1 text-sm text-muted-foreground",
                detailHasAmount && "privacy-sensitive",
              )}
            >
              {detail}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="pill"
              className="gap-3"
              onClick={() => setOpen(true)}
            >
              {t("monthClose.closeTheMonth")}
              <ButtonNub>
                <ArrowRight size={ICON.md} />
              </ButtonNub>
            </Button>
          </div>
        </div>
      </Card.Bezel>

      <MonthCloseSheet
        open={open}
        onOpenChange={setOpen}
        year={year}
        month={month}
        monthLabel={monthLabel}
        observeOn={observeOn}
        isBaseline={isBaseline}
        monthlyCommitted={monthlyCommitted}
        unrecordedCap={unrecordedCap}
        baseline={baseline}
      />
    </>
  );
}
