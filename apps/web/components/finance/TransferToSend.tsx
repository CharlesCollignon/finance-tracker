"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { formatShortDate } from "@finance/core/constants";
import { describeDcaNeed, type TransferReminder } from "@finance/core/dca-need";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

/**
 * « À envoyer au courtier » — how much the transfer that follows the DCAs
 * should be this month, from three days before payday until it is sent
 * (`transferReminder`). The figure is the one its charge holds, so it leads
 * there; the push before payday says the same words.
 */
export function TransferToSend({ transfer }: { transfer: TransferReminder }) {
  const t = useT();
  const locale = useLocale();
  const formatMoney = useFormatCurrency();

  return (
    <section aria-label={t("dcaTransfer.title")} className="flex flex-col">
      <div className="border-b border-foreground/10 px-4 py-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("dcaTransfer.title")}
        </h3>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{transfer.label}</span>
            <PrivateAmount
              className={cn("tabular-nums", TYPE_AMOUNT_CLASS.investment)}
            >
              {`${amountSign("investment")}${formatMoney(transfer.need.amount)}`}
            </PrivateAmount>
          </p>
          <p className="privacy-sensitive mt-0.5 text-xs text-muted-foreground">
            {describeDcaNeed(transfer.need, t, locale)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("dcaTransfer.due", {
              date: formatShortDate(transfer.occurredOn, locale),
            })}
          </p>
        </div>

        <Link
          href="/recurring"
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-full px-3 text-sm sm:self-auto",
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
