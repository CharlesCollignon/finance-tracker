"use client";

import { Receipt } from "@phosphor-icons/react";
import {
  formatMonthLabel,
  formatPercentLabel,
  monthSearchParams,
  shiftMonth,
} from "@finance/core/constants";
import type { BearingMonth } from "@/lib/bearing/month";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import {
  MyShareToggle,
  useMyShare,
} from "@/components/finance/bearing/MyShareToggle";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { ICON } from "@/lib/icon-scale";
import { FIGURE } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import { Card } from "@/components/finance/bearing/card-parts";

/* ------------------------------------------------------------ the spending */

export function SpentCard({ data }: { data: BearingMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { spent } = data;
  const current = data.balance.period === "current";
  const previous = shiftMonth(data.year, data.month, -1);
  const previousLabel = formatMonthLabel(previous.year, previous.month, locale);

  const comparison = (() => {
    if (spent.previous === null || spent.previous === 0) {
      return null;
    }
    const difference = spent.total - spent.previous;
    if (Math.abs(difference) < 1) {
      return {
        text: t("bearingMonth.spentSame", { month: previousLabel }),
        better: true,
      };
    }
    const amount = format(Math.abs(difference));
    const key =
      difference < 0
        ? current
          ? "bearingMonth.spentLessSoFar"
          : "bearingMonth.spentLess"
        : current
          ? "bearingMonth.spentMoreSoFar"
          : "bearingMonth.spentMore";
    return {
      text: t(key, { amount, month: previousLabel }),
      better: difference < 0,
    };
  })();

  const peak = Math.max(1, ...spent.trend.map((point) => point.total));
  const shownKey = `${data.year}-${String(data.month).padStart(2, "0")}`;

  return (
    <Card
      icon={<Receipt size={ICON.sm} weight="bold" />}
      title={t("bearingMonth.spent")}
      href={`/transactions${monthSearchParams(data.year, data.month)}`}
      hrefLabel={t("bearingMonth.seeInLedger")}
      action={data.myShare ? <MyShareToggle /> : null}
    >
      <AnimatedAmount
        value={spent.total}
        format={format}
        className={cn(FIGURE, "block")}
      />
      <MyShareCaption data={data} />

      {comparison ? (
        <p
          className={cn(
            "text-sm",
            comparison.better ? "text-success" : "text-muted-foreground",
          )}
        >
          <PrivateAmount>{comparison.text}</PrivateAmount>
        </p>
      ) : null}

      {/* Six months of spending, this one lit and the rest in the background:
          one series, so emphasis rather than colour. */}
      <div className="mt-auto flex h-20 items-end gap-2" role="list">
        {spent.trend.map((point) => {
          const shown = point.monthKey === shownKey;
          return (
            <div
              key={point.monthKey}
              role="listitem"
              className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="sr-only">
                {`${point.label}: ${format(point.total)}`}
              </span>
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -top-7 whitespace-nowrap rounded-control bg-popover px-2 py-0.5 text-[0.6875rem] tabular-nums opacity-0",
                  "privacy-amount transition-opacity duration-hover group-hover:opacity-100",
                )}
              >
                {format(point.total)}
              </span>
              <span
                aria-hidden
                className={cn(
                  "w-full max-w-6 origin-bottom rounded-t-[4px] transition-colors duration-hover",
                  shown
                    ? "bg-primary"
                    : "bg-foreground/15 group-hover:bg-foreground/30",
                )}
                style={{
                  height: `${Math.max(4, (point.total / peak) * 100)}%`,
                  // Counting the part of the space or not moves every bar:
                  // they grow or shrink to it rather than jump.
                  transition: "height 500ms cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              />
              <span
                aria-hidden
                className={cn(
                  "text-[0.6875rem] uppercase",
                  shown ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {point.label.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Under the spent figure while « Avec ma part du commun » is on: what it
 * counts, so the figure is never a mystery.
 */
function MyShareCaption({ data }: { data: BearingMonth }) {
  const t = useT();
  const locale = useLocale();
  const shown = useMyShare();
  if (!data.myShare || !shown?.on || data.myShare.part === null) {
    return null;
  }
  return (
    <p className="text-xs text-muted-foreground">
      {t("space.myShareCaption", {
        part: formatPercentLabel(data.myShare.part * 100, locale),
      })}
    </p>
  );
}
