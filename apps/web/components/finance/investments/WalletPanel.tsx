"use client";

import { useMemo, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { RemoveAccount } from "@/components/finance/accounts/RemoveAccount";
import {
  PRICE_RANGES,
  type InstrumentPriceSeries,
  type PriceRange,
} from "@finance/core/instrument-price-series";
import {
  POSITION_ORDERS,
  sortPositions,
  type PositionOrder,
  type InvestmentColumnSummary,
  type InvestmentPositionItem,
} from "@finance/core/investment-positions";
import { useFormatCurrency } from "@/lib/use-currency";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { formatSigned } from "@finance/core/amount-sign";
import { InvestmentPositionRow } from "@/components/finance/investments/InvestmentPositionRow";
import { Metric } from "@/components/finance/investments/metrics";

/** One wallet on the Placements screen: its figures, its chart, its positions. */

interface WalletPanelProps {
  column: InvestmentColumnSummary;
  priceSeries: Record<string, InstrumentPriceSeries>;
  onEdit: (item: InvestmentPositionItem) => void;
  onAdd: () => void;
  /** What removing the wallet takes with it, in a sentence. */
  removeConfirm: string;
  onRemove: () => Promise<{ error?: string; message?: string }>;
}

/** "1M", "1Y", "5Y" read the same in both languages; only "All" is a word. */
function rangeLabel(range: PriceRange, allLabel: string): string {
  return range === "ALL" ? allLabel : range;
}

export function WalletPanel({
  column,
  priceSeries,
  onEdit,
  onAdd,
  removeConfirm,
  onRemove,
}: WalletPanelProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const showPl = column.hasMarketSnapshot && column.totalGainLoss !== 0;
  const [range, setRange] = useState<PriceRange>("1Y");
  // Largest first by default. A wallet is opened to see where the money is
  // before it is opened to find one holding by name, and the alphabet is one
  // press away for the times it is the other way round.
  const [order, setOrder] = useState<PositionOrder>("invested");

  // One switch for the whole wallet, so the rows are comparable: reading two
  // holdings over different windows and calling it a comparison is the thing
  // a per-row control would quietly invite.
  const rangeSegments = useMemo(() => {
    const drawable = (candidate: PriceRange) =>
      column.items.some((item) => {
        const series = item.instrumentSymbol
          ? priceSeries[item.instrumentSymbol]
          : undefined;
        return (series?.[candidate].values.length ?? 0) > 1;
      });

    return PRICE_RANGES.map((candidate) => ({
      value: candidate,
      label: rangeLabel(candidate, t("wallets.rangeAll")),
      disabled: !drawable(candidate),
    }));
  }, [column.items, priceSeries, t]);

  const anyDrawable = rangeSegments.some((segment) => !segment.disabled);

  const orderSegments = POSITION_ORDERS.map((candidate) => ({
    value: candidate,
    label:
      candidate === "name"
        ? t("wallets.orderByName")
        : t("wallets.orderByInvested"),
  }));

  const ordered = useMemo(
    () => sortPositions(column.items, order),
    [column.items, order],
  );

  return (
    <Card.Bezel
      className="w-full"
      innerClassName="flex w-full min-w-0 max-w-full flex-col gap-6 p-5 md:p-6"
    >
      <div className="flex min-w-0 flex-col items-center gap-3 text-center">
        <div className="grid w-full min-w-0 max-w-md grid-cols-3 gap-2 sm:gap-4">
          <Metric
            label={t("wallets.value")}
            value={formatEuro(column.totalMarketValue)}
          />
          <Metric
            label={t("wallets.invested")}
            value={formatEuro(column.totalInvested)}
          />
          <Metric
            label={t("wallets.profitLoss")}
            value={
              showPl ? formatSigned(column.totalGainLoss, formatEuro) : "—"
            }
            tone={
              showPl
                ? column.totalGainLoss > 0
                  ? "positive"
                  : column.totalGainLoss < 0
                    ? "negative"
                    : "neutral"
                : "neutral"
            }
          />
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("wallets.positions")}
          </h3>
          <Button size="sm" variant="link" onClick={onAdd}>
            <Plus size={ICON.md} weight="light" className="mr-1" />
            {t("position.addItem")}
          </Button>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          {/* Only offered where it could change anything: one holding is
              already in every order there is. */}
          {column.items.length > 1 ? (
            <SegmentedControl
              segments={orderSegments}
              value={order}
              onChange={setOrder}
              label={t("wallets.orderBy")}
              className="w-full max-w-[13rem]"
            />
          ) : null}
          {anyDrawable ? (
            <SegmentedControl
              segments={rangeSegments}
              value={range}
              onChange={setRange}
              label={t("common.chartRange")}
              className="w-full max-w-[15rem]"
            />
          ) : null}
        </div>

        {column.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("wallets.noItems")}
          </p>
        ) : (
          <ul className="flex min-w-0 flex-col divide-y divide-border">
            {ordered.map((item) => (
              <li key={item.id} className="min-w-0">
                <InvestmentPositionRow
                  item={item}
                  series={
                    item.instrumentSymbol
                      ? priceSeries[item.instrumentSymbol]
                      : undefined
                  }
                  range={range}
                  onEdit={() => onEdit(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <RemoveAccount confirmText={removeConfirm} onRemove={onRemove} />
      </div>
    </Card.Bezel>
  );
}
