import { useMemo, useState } from "react";
import { View } from "react-native";

import { formatPercentLabel } from "@finance/core/constants";
import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import { buildHoldingsOverview } from "@finance/core/holdings-overview";
import {
  formatSignedPercent,
  PRICE_RANGES,
  type InstrumentPriceSeries,
  type PriceRange,
} from "@finance/core/instrument-price-series";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";

import { InstrumentLogo } from "@/components/InstrumentLogo";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";

/**
 * « Toutes vos lignes » — the web's `HoldingsCard`, from the same core
 * reading: every holding of every wallet in one list, largest first, which
 * Comptes, showing one account at a time, never puts side by side. Each row
 * says what the line is worth, its share of everything invested, what the
 * holder has made on it, and what its instrument's price did over the
 * chosen range.
 *
 * Only the return is coloured, as on a tile: the price is the instrument's,
 * and stays grey. The share's bar is one neutral colour — a weight is a
 * fact here, not a target met or missed.
 */
export function HoldingsCard({
  portfolio,
  priceSeries,
}: {
  portfolio: InvestmentPortfolioSummary;
  /** What each held instrument's price did, keyed by symbol; empty until read. */
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
  // A range no held instrument has a line for is offered greyed.
  const segments = useMemo(
    () =>
      PRICE_RANGES.map((candidate) => ({
        value: candidate,
        label: candidate === "ALL" ? t("wallets.rangeAll") : candidate,
        disabled: !buildHoldingsOverview(portfolio, priceSeries, candidate).hasPrices,
      })),
    [portfolio, priceSeries, t],
  );
  const anyPrices = segments.some((segment) => !segment.disabled);

  if (overview.rows.length === 0) {
    return null;
  }

  return (
    <Card bezel innerClassName="gap-3 p-5">
      <Text className="font-bold">{t("wallets.holdingsTitle")}</Text>
      {anyPrices ? (
        <SegmentedControl
          segments={segments}
          value={range}
          onChange={setRange}
          label={t("common.chartRange")}
        />
      ) : null}
      <Text variant="muted" className="text-sm">
        {t("wallets.holdingsBody")}
      </Text>

      <View>
        {overview.rows.map((row) => {
          const share =
            row.weight === null
              ? null
              : formatPercentLabel(Math.round(row.weight * 100), locale);
          return (
            <View
              key={row.id}
              accessible
              accessibilityLabel={[
                row.name,
                t(ENVELOPE_SHORT_KEYS[row.walletId]),
                share === null ? null : t("wallets.holdingsShare", { share }),
                `${t("wallets.holdingsReturn")} ${formatSignedPercent(row.returnPct, locale)}`,
                `${t("wallets.holdingsPrice")} ${formatSignedPercent(row.priceChangePct, locale)}`,
              ]
                .filter(Boolean)
                .join(", ")}
              className="gap-2 border-t border-border py-3"
            >
              <View className="flex-row items-center gap-3">
                <InstrumentLogo symbol={row.instrumentSymbol} fallbackIcon={row.icon} />
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm font-medium">
                    {row.name}
                  </Text>
                  <Text variant="muted" className="text-xs">
                    {t(ENVELOPE_SHORT_KEYS[row.walletId])}
                  </Text>
                </View>
                <PrivateAmount className="text-sm font-medium">
                  {formatEuro(row.value)}
                </PrivateAmount>
              </View>

              {/* Its share of everything invested: a bar and its figure. */}
              <View className="flex-row items-center gap-2">
                <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <View
                    className="h-full rounded-full bg-foreground/45"
                    style={{ width: `${(row.weight ?? 0) * 100}%` }}
                  />
                </View>
                <PrivateAmount className="w-10 text-right text-xs text-muted-foreground">
                  {share ?? "—"}
                </PrivateAmount>
              </View>

              <View className="flex-row items-baseline justify-between gap-3">
                <View className="flex-row items-baseline gap-1.5">
                  <Text variant="muted" className="text-xs">
                    {t("wallets.holdingsReturn")}
                  </Text>
                  <PrivateAmount
                    className={cn(
                      "text-sm font-medium",
                      row.returnPct === null
                        ? "text-muted-foreground"
                        : row.returnPct > 0
                          ? "text-success"
                          : row.returnPct < 0
                            ? "text-destructive"
                            : "text-foreground",
                    )}
                  >
                    {formatSignedPercent(row.returnPct, locale)}
                  </PrivateAmount>
                </View>
                <View className="flex-row items-baseline gap-1.5">
                  <Text variant="muted" className="text-xs">
                    {t("wallets.holdingsPrice")}
                  </Text>
                  <Text variant="muted" className="text-sm tabular-nums">
                    {formatSignedPercent(row.priceChangePct, locale)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <Text variant="muted" className="border-t border-border pt-3 text-xs">
        {t("wallets.holdingsNote")}
      </Text>
    </Card>
  );
}
