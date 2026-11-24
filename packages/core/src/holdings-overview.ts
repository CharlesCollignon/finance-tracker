/**
 * Every holding of every wallet, side by side: what each is worth, its
 * share of all that is invested, what the holder has made on it, and what
 * its instrument's own price did over a chosen range.
 *
 * Comptes shows one account at a time, so a reader with a PEA, a CTO and
 * crypto never saw their lines together. This is that list, and nothing
 * else: no order to rebalance into, no verdict on a weight.
 *
 * The last two figures answer different questions and are kept apart, as on
 * a tile: the return is the holder's own — bought over months, each time at
 * its price — and the price move is the instrument's.
 */

import type {
  InstrumentPriceSeries,
  PriceRange,
} from "./instrument-price-series";
import {
  positionReturnPct,
  type InvestmentPortfolioSummary,
  type InvestmentWalletId,
} from "./investment-positions";

export interface HoldingRow {
  id: string;
  walletId: InvestmentWalletId;
  name: string;
  icon: string | null;
  instrumentSymbol: string | null;
  /** What it is worth today. */
  value: number;
  /** Its share of everything invested, 0 to 1. Null while that is nothing. */
  weight: number | null;
  /** What the holder has made on it, in percent. Null when it can't be said. */
  returnPct: number | null;
  /** The instrument's own price over the range, in percent. Null without one. */
  priceChangePct: number | null;
}

export interface HoldingsOverview {
  /** Largest first; names break a tie, so the order never flickers. */
  rows: HoldingRow[];
  /** Everything the rows are worth together. */
  total: number;
  /** Whether any row has a price move to show for this range. */
  hasPrices: boolean;
}

export function buildHoldingsOverview(
  portfolio: Pick<InvestmentPortfolioSummary, "columns">,
  priceSeries: Readonly<Record<string, InstrumentPriceSeries | undefined>>,
  range: PriceRange,
): HoldingsOverview {
  // A holding still waiting for its share count has no value to weigh.
  const items = portfolio.columns.flatMap((column) =>
    column.items.filter((item) => !item.needsShareCount),
  );
  const total = items.reduce((sum, item) => sum + item.marketValue, 0);

  const rows = items
    .map((item): HoldingRow => {
      const series = item.instrumentSymbol
        ? priceSeries[item.instrumentSymbol]
        : undefined;
      return {
        id: item.id,
        walletId: item.walletId,
        name: item.name,
        icon: item.icon,
        instrumentSymbol: item.instrumentSymbol,
        value: item.marketValue,
        weight: total > 0 ? item.marketValue / total : null,
        returnPct: positionReturnPct(item),
        priceChangePct: series?.[range].changePct ?? null,
      };
    })
    .sort(
      (left, right) =>
        right.value - left.value || left.name.localeCompare(right.name),
    );

  return {
    rows,
    total,
    hasPrices: rows.some((row) => row.priceChangePct !== null),
  };
}

/** The symbol of every instrument held, once each: what the price lines are read for. */
export function heldSymbols(
  portfolio: Pick<InvestmentPortfolioSummary, "columns">,
): string[] {
  return Array.from(
    new Set(
      portfolio.columns.flatMap((column) =>
        column.items
          .map((item) => item.instrumentSymbol)
          .filter((symbol): symbol is string => Boolean(symbol)),
      ),
    ),
  );
}

/** The gain over what was put in, as a ratio: 0.105 for +10.5 %. Null with nothing put in. */
export function returnShare(gainLoss: number, invested: number): number | null {
  return invested > 0 ? gainLoss / invested : null;
}
