"use client";

import { useMemo, useState } from "react";
import { formatPercentLabel } from "@finance/core/constants";
import { buildHoldingsOverview } from "@finance/core/holdings-overview";
import {
  formatSignedPercent,
  PRICE_RANGES,
  type InstrumentPriceSeries,
  type PriceRange,
} from "@finance/core/instrument-price-series";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import { accountShortName } from "@/components/finance/accounts/account-format";
import { InstrumentLogo } from "@/components/finance/InstrumentLogo";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

/**
 * « Toutes vos lignes »: every holding of every wallet in one list, largest
 * first — what Comptes, which shows one account at a time, never puts side
 * by side. Each row says what the line is worth, its share of everything
 * invested, what the holder has made on it, and what its instrument's price
 * did over the chosen range.
 *
 * Only the return is coloured, as on a tile: the price is the instrument's,
 * and stays in the grey of the tiles' price line. The share's bar is one
 * neutral colour — a weight is a fact here, not a target met or missed.
 */
export function HoldingsCard({
  portfolio,
  priceSeries,
}: {
  portfolio: InvestmentPortfolioSummary;
  /** What each held instrument's price did, keyed by symbol. */
  priceSeries: Record<string, InstrumentPriceSeries>;
}) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const [range, setRange] = useState<PriceRange>("1Y");
  const overview = useMemo(
    () => buildHoldingsOverview(portfolio, priceSeries, range),
    [portfolio, priceSeries, range],
  );
  // A range no held instrument has a line for is offered greyed, as on a
  // wallet's panel.
  const segments = useMemo(
    () =>
      PRICE_RANGES.map((candidate) => ({
        value: candidate,
        label: candidate === "ALL" ? t("wallets.rangeAll") : candidate,
        disabled: !buildHoldingsOverview(portfolio, priceSeries, candidate)
          .hasPrices,
      })),
    [portfolio, priceSeries, t],
  );
  const anyPrices = segments.some((segment) => !segment.disabled);

  if (overview.rows.length === 0) {
    return null;
  }

  return (
    <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-head text-base">{t("wallets.holdingsTitle")}</h2>
        {anyPrices ? (
          <SegmentedControl
            segments={segments}
            value={range}
            onChange={setRange}
            label={t("common.chartRange")}
            className="w-full max-w-[15rem]"
          />
        ) : null}
      </div>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        {t("wallets.holdingsBody")}
      </p>

      {/* The columns' names, once the rows are wide enough to be columns. */}
      <div
        aria-hidden
        className="mt-4 hidden grid-cols-[minmax(0,1fr)_7rem_9rem_5.5rem_5.5rem] items-center gap-4 border-b border-border pb-2 text-xs text-muted-foreground md:grid"
      >
        <span>{t("wallets.positions")}</span>
        <span className="text-right">{t("wallets.value")}</span>
        <span>{t("wallets.holdingsWeight")}</span>
        <span className="text-right">{t("wallets.holdingsReturn")}</span>
        <span className="text-right">{t("wallets.holdingsPrice")}</span>
      </div>

      <ul className="flex flex-col divide-y divide-border max-md:mt-4 max-md:border-t max-md:border-border">
        {overview.rows.map((row) => {
          const share =
            row.weight === null
              ? null
              : formatPercentLabel(Math.round(row.weight * 100), locale);
          return (
            <li
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 text-sm md:grid-cols-[minmax(0,1fr)_7rem_9rem_5.5rem_5.5rem]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <InstrumentLogo
                  symbol={row.instrumentSymbol}
                  name={row.name}
                  fallbackIcon={row.icon}
                  className="size-8 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{row.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {accountShortName(row.walletId, locale)}
                  </span>
                </span>
              </span>

              <span className="privacy-amount text-right font-medium tabular-nums">
                {formatEuro(row.value)}
              </span>

              {/* Its share of everything invested: a bar and its figure. */}
              <span
                className="flex items-center gap-2 max-md:col-span-2"
                title={
                  share === null
                    ? undefined
                    : t("wallets.holdingsShare", { share })
                }
              >
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-foreground/45"
                    style={{ width: `${(row.weight ?? 0) * 100}%` }}
                  />
                </span>
                <span className="privacy-sensitive w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {share ?? "—"}
                </span>
              </span>

              <span className="flex items-baseline gap-1.5 md:justify-end">
                <span className="text-xs text-muted-foreground md:hidden">
                  {t("wallets.holdingsReturn")}
                </span>
                <span
                  className={cn(
                    "privacy-amount text-sm font-medium tabular-nums",
                    row.returnPct === null && "text-muted-foreground",
                    row.returnPct !== null &&
                      row.returnPct > 0 &&
                      "text-success",
                    row.returnPct !== null &&
                      row.returnPct < 0 &&
                      "text-destructive",
                  )}
                >
                  {formatSignedPercent(row.returnPct, locale)}
                </span>
              </span>

              <span className="flex items-baseline justify-end gap-1.5">
                <span className="text-xs text-muted-foreground md:hidden">
                  {t("wallets.holdingsPrice")}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatSignedPercent(row.priceChangePct, locale)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        {t("wallets.holdingsNote")}
      </p>
    </Card.Bezel>
  );
}
