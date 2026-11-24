"use client";

import { useState } from "react";
import { formatSignedPercentOf } from "@finance/core/constants";
import { quarterLabel } from "@finance/core/property";
import type { PriceHistory } from "@finance/core/property-history";
import { HistoryLine } from "@/components/finance/charts";
import { Card } from "@/components/ui/Card";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";

/**
 * A property's price history: what its area's prices have done to its
 * purchase price, quarter by quarter. One figure — the move since the
 * purchase — over the line that makes it, then the three amounts a reader
 * looks for: what was paid, what that is at today's prices, and the
 * estimated value when it comes from somewhere else.
 *
 * The figure is not coloured: it is a fact about the area, not a result.
 */
export function PriceHistoryCard({ history }: { history: PriceHistory }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const [active, setActive] = useState<number | null>(null);
  const first = history.points[0]!;
  const last = history.points.at(-1)!;
  const read = active === null ? null : history.points[active]!;

  return (
    <Card.Bezel
      className="w-full"
      innerClassName="flex w-full min-w-0 flex-col gap-5 p-5 md:p-6"
    >
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-head text-lg">{t("property.historyTitle")}</h3>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            {t("property.historySince", {
              quarter: quarterLabel(first.quarter, locale),
            })}
          </p>
          <p className="font-serif text-3xl font-semibold tabular-nums tracking-[-0.02em]">
            {formatSignedPercentOf(history.change, locale)}
          </p>
        </div>
        {/* What the pointer is on; today's point while it is nowhere. */}
        <p
          aria-live="polite"
          className="text-right text-sm text-muted-foreground"
        >
          <span className="block text-xs">
            {quarterLabel((read ?? last).quarter, locale)}
          </span>
          <span className="privacy-amount font-medium tabular-nums text-foreground">
            {format((read ?? last).value)}
          </span>
        </p>
      </div>

      <div className="min-w-0">
        <HistoryLine
          values={history.points.map((point) => point.value)}
          mark={history.estimate?.value ?? null}
          active={active}
          onActive={setActive}
          label={t("property.historyChartLabel")}
          format={format}
        />
        <div className="mt-2 flex justify-between pl-16 pr-1.5 text-[11px] text-muted-foreground">
          <span>{quarterLabel(first.quarter, locale)}</span>
          <span>{quarterLabel(last.quarter, locale)}</span>
        </div>
      </div>

      <dl className="grid min-w-0 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label={t("property.historyPaid")}
          value={format(history.paid)}
        />
        <Figure
          label={t("property.historyCarried", {
            quarter: quarterLabel(last.quarter, locale),
          })}
          value={format(history.carried)}
          swatch="line"
        />
        {history.estimate ? (
          <Figure
            label={
              history.estimate.kind === "market"
                ? t("property.historyEstimateMarket")
                : t("property.historyEstimateOwn")
            }
            value={format(history.estimate.value)}
            swatch="mark"
          />
        ) : null}
        {history.peak ? (
          <Figure
            label={`${t("property.historyPeak")} · ${quarterLabel(history.peak.quarter, locale)}`}
            value={format(history.peak.value)}
          />
        ) : null}
      </dl>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {history.startsLate
          ? `${t("property.historyStartsLate", {
              quarter: quarterLabel(first.quarter, locale),
            })} `
          : null}
        {t("property.historyLead")} {t("property.historyNote")}
      </p>
    </Card.Bezel>
  );
}

/** One amount under the chart, with the mark that draws it when it has one. */
function Figure({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch?: "line" | "mark";
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {swatch === "line" ? (
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-primary" />
        ) : swatch === "mark" ? (
          <span
            aria-hidden
            className="size-2.5 rounded-full border-2 border-primary"
          />
        ) : null}
        {label}
      </dt>
      <dd className="privacy-amount mt-1 text-sm font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}
