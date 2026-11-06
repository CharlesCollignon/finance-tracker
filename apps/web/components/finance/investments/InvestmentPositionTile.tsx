"use client";

import { InstrumentLogo } from "@/components/finance/InstrumentLogo";
import { Sparkline } from "@/components/finance/charts";
import { formatBtcAmount, isCryptoWallet } from "@finance/core/crypto-holdings";
import {
  formatSignedPercent,
  type InstrumentPriceSeries,
  type PriceRange,
} from "@finance/core/instrument-price-series";
import {
  positionReturnPct,
  type InvestmentPositionItem,
} from "@finance/core/investment-positions";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { useLocale, useT } from "@/lib/locale-context";

interface InvestmentPositionTileProps {
  item: InvestmentPositionItem;
  /** Absent for a holding with no linked instrument — it simply has no line. */
  series: InstrumentPriceSeries | undefined;
  range: PriceRange;
  onEdit: () => void;
}

/**
 * One position in a wallet, as a tile (the owner's pick, November 2026, the
 * phone's tile at every width): its mark and its return at the top, its
 * name, what it is worth in the figure face, what went into it, and the
 * instrument's price over the chosen range as a faint grey line at the foot.
 *
 * It replaced a row of three labelled figures beside a coloured price line.
 * The line is grey now: coloured, it said "up" in green beside a holding
 * that had lost money, because the price of a share and what someone made
 * buying it over time are two questions. Only the return is coloured.
 */
export function InvestmentPositionTile({
  item,
  series,
  range,
  onEdit,
}: InvestmentPositionTileProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const locale = useLocale();
  const isCrypto = isCryptoWallet(item.walletId);

  const priceLine = series?.[range];
  const hasPriceLine = (priceLine?.values.length ?? 0) > 1;
  const returnPct = positionReturnPct(item);

  return (
    // The whole tile opens the position, as a ledger row does.
    <button
      type="button"
      onClick={onEdit}
      aria-label={t("wallets.editPosition", { name: item.name })}
      className={cn(
        "position-tile flex h-full min-h-[10rem] w-full min-w-0 flex-col gap-2.5 rounded-card border border-border bg-muted/30 p-3.5 text-left",
        "transition-[background-color,scale] duration-press hover:bg-muted/60 active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <InstrumentLogo
          symbol={item.instrumentSymbol}
          name={item.name}
          fallbackIcon={item.icon}
          className="size-8 shrink-0"
        />
        {returnPct !== null ? (
          <span
            className={cn(
              "privacy-amount rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              returnPct > 0 && "bg-success/15 text-success",
              returnPct < 0 && "bg-destructive/15 text-destructive",
              returnPct === 0 && "bg-muted text-muted-foreground",
            )}
          >
            {formatSignedPercent(returnPct, locale)}
          </span>
        ) : null}
      </span>

      <span className="line-clamp-2 text-sm font-semibold leading-tight">
        {item.name}
      </span>

      <span className="mt-auto flex min-w-0 flex-col gap-0.5">
        {item.needsShareCount ? (
          <span className="text-xs font-medium text-foreground">
            {isCrypto
              ? t("wallets.addBtcForValue")
              : t("wallets.addSharesForValue")}
          </span>
        ) : (
          <span className="privacy-amount truncate font-serif text-[1.375rem] font-semibold tabular-nums tracking-[-0.03em]">
            {formatEuro(item.marketValue)}
          </span>
        )}
        <span className="truncate text-xs text-muted-foreground">
          {t("wallets.invested")}{" "}
          <span className="privacy-amount tabular-nums">
            {formatEuro(item.totalInvested)}
          </span>
          {isCrypto && item.shareCount !== null && item.shareCount > 0
            ? ` · ${formatBtcAmount(item.shareCount, locale)}`
            : null}
        </span>
      </span>

      {/* Its room kept when there is no line, so the figures of tiles side
          by side sit on one level. */}
      <span className="block h-6 w-full">
        {hasPriceLine ? (
          <Sparkline
            values={priceLine!.values}
            height={24}
            fluid
            colorVar="--muted-foreground"
            className="opacity-60"
          />
        ) : null}
      </span>
    </button>
  );
}
