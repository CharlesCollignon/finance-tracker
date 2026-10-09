"use client";

import { PencilSimple } from "@phosphor-icons/react";
import { InstrumentLogo } from "@/components/finance/InstrumentLogo";
import { Sparkline } from "@/components/finance/charts";
import { formatBtcAmount, isCryptoWallet } from "@finance/core/crypto-holdings";
import {
  formatSignedPercent,
  type InstrumentPriceSeries,
  type PriceRange,
} from "@finance/core/instrument-price-series";
import type { InvestmentPositionItem } from "@finance/core/investment-positions";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { formatSigned } from "@finance/core/amount-sign";
import {
  InlineMetric,
  PRICE_TONE_VARS,
} from "@/components/finance/investments/metrics";

/** One position in a wallet, on the Placements screen. */

interface InvestmentPositionRowProps {
  item: InvestmentPositionItem;
  /** Absent for a holding with no linked instrument — it simply has no line. */
  series: InstrumentPriceSeries | undefined;
  range: PriceRange;
  onEdit: () => void;
}

export function InvestmentPositionRow({
  item,
  series,
  range,
  onEdit,
}: InvestmentPositionRowProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const locale = useLocale();
  const isCrypto = isCryptoWallet(item.walletId);
  const valueLabel =
    item.hasManualValue || item.hasMarketQuote
      ? t("wallets.market")
      : t("wallets.invested");

  const priceLine = series?.[range];
  const hasPriceLine = (priceLine?.values.length ?? 0) > 1;
  const changePct = priceLine?.changePct ?? null;

  // What the holding returned, beside what it returned in euro. Distinct from
  // the price move on the right: this one counts every contribution, so a
  // holding bought into all year rarely matches its instrument's line.
  const returnPct =
    item.totalInvested > 0
      ? Math.round((item.gainLoss / item.totalInvested) * 10000) / 100
      : null;
  const priceTone =
    changePct === null || changePct === 0
      ? "neutral"
      : changePct > 0
        ? "positive"
        : "negative";

  return (
    <div className="min-w-0 max-w-full py-4">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <InstrumentLogo
            symbol={item.instrumentSymbol}
            name={item.name}
            fallbackIcon={item.icon}
            className="size-8 shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-snug">
              {item.name}
            </p>
            {item.instrumentSymbol ? (
              <p className="truncate text-xs text-muted-foreground">
                {isCrypto
                  ? "Bitcoin"
                  : (item.instrumentName ?? item.instrumentSymbol)}
              </p>
            ) : null}
            {item.needsShareCount ? (
              <p className="mt-1 text-xs font-medium text-foreground">
                {isCrypto
                  ? t("wallets.addBtcForValue")
                  : t("wallets.addSharesForValue")}
              </p>
            ) : null}
            {isCrypto && item.shareCount !== null && item.shareCount > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatBtcAmount(item.shareCount, locale)}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("wallets.editPosition", { name: item.name })}
        >
          <PencilSimple size={ICON.md} weight="light" />
        </button>
      </div>

      {/* The figures and the line share one row. Stacked, they were three
          bands of height per holding; side by side a wallet of a dozen fits
          on one screen. */}
      <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-xs sm:text-sm">
          <InlineMetric
            label={valueLabel}
            value={formatEuro(item.marketValue)}
          />
          <InlineMetric
            label={t("wallets.invested")}
            value={formatEuro(item.totalInvested)}
          />
          <InlineMetric
            label={t("wallets.profitLoss")}
            value={formatSigned(item.gainLoss, formatEuro)}
            suffix={
              returnPct === null
                ? undefined
                : formatSignedPercent(returnPct, locale)
            }
            tone={
              item.gainLoss > 0
                ? "positive"
                : item.gainLoss < 0
                  ? "negative"
                  : "neutral"
            }
          />
        </div>

        {hasPriceLine ? (
          <div className="flex shrink-0 items-center gap-2">
            <Sparkline
              values={priceLine!.values}
              width={110}
              height={26}
              colorVar={PRICE_TONE_VARS[priceTone]}
            />
            <span
              className={cn(
                "font-mono text-xs tabular-nums",
                priceTone === "positive" && "text-success",
                priceTone === "negative" && "text-destructive",
                priceTone === "neutral" && "text-muted-foreground",
              )}
            >
              {formatSignedPercent(changePct, locale)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
