"use client";

import { CalendarDots } from "@phosphor-icons/react";
import { formatDayMonth, monthSearchParams } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import type { BearingMonth } from "@/lib/bearing/month";
import { amountSign } from "@finance/core/amount-sign";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import { Card } from "@/components/finance/bearing/card-parts";

/** How many charges still to come the card lists before "+N more". */
const UPCOMING_SHOWN = 4;

/* ------------------------------------------------------------ what comes */

export function UpcomingCard({ data }: { data: BearingMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const upcoming = data.upcoming!;
  const shown = upcoming.charges.slice(0, UPCOMING_SHOWN);
  const more = upcoming.charges.length - shown.length;

  return (
    <Card
      icon={<CalendarDots size={ICON.sm} weight="bold" />}
      title={
        data.balance.period === "future"
          ? t("bearingMonth.plannedThisMonth")
          : t("bearingMonth.stillToCome")
      }
      href={`/transactions${monthSearchParams(data.year, data.month)}`}
      hrefLabel={t("bearingMonth.seeInLedger")}
    >
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("bearingMonth.nothingToCome")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((charge) => (
            <li key={charge.key} className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-control border border-dashed border-hairline-strong leading-none">
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    charge.awaited && "text-muted-foreground",
                  )}
                >
                  {Number(charge.occurredOn.slice(8, 10))}
                </span>
                <span className="mt-0.5 text-[0.625rem] uppercase text-muted-foreground">
                  {formatDayMonth(charge.occurredOn, locale).split(" ")[1]}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {charge.description?.trim() || charge.name}
                </span>
                {/* Its day is behind it and the bank has not brought it: it
                    is still to leave, but not coming up, and the date alone
                    would read as the card having fallen behind. */}
                {charge.awaited ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {t("ledger.awaited")}
                  </span>
                ) : null}
              </span>
              <PrivateAmount
                className={cn(
                  "shrink-0 text-sm tabular-nums",
                  TYPE_AMOUNT_CLASS[charge.type],
                )}
              >
                {`${amountSign(charge.type)}${format(charge.amount)}`}
              </PrivateAmount>
            </li>
          ))}
        </ul>
      )}
      {more > 0 ? (
        <p className="mt-auto text-xs text-muted-foreground">
          {t("bearingMonth.moreToCome", { count: more })}
        </p>
      ) : null}
    </Card>
  );
}
