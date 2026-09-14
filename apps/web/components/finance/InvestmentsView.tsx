"use client";

import { useMemo, useState } from "react";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SurfaceTabs, WALLET_TABS } from "@/components/layout/SurfaceTabs";
import { RefreshQuotesButton } from "@/components/finance/RefreshQuotesButton";
import { EmptyState } from "@/components/layout/EmptyState";
import { InstrumentLogo } from "@/components/finance/InstrumentLogo";
import { Sparkline } from "@/components/finance/charts";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { InvestmentPositionSheet } from "@/components/finance/InvestmentPositionSheet";
import { StatHero } from "@/components/finance/StatHero";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { formatBtcAmount, isCryptoWallet } from "@finance/core/crypto-holdings";
import {
  formatSignedPercent,
  PRICE_RANGES,
  type InstrumentPriceSeries,
  type PriceRange,
} from "@finance/core/instrument-price-series";
import type { WalletFundingNeed } from "@finance/core/investment-upcoming";
import {
  INVESTMENT_WALLET_LABELS,
  INVESTMENT_WALLET_IDS,
  type InvestmentWalletId,
} from "@finance/core/investments";
import {
  portfolioHasActivity,
  recurringTemplatesForWallet,
  type InvestmentColumnSummary,
  type InvestmentPortfolioSummary,
  type InvestmentPositionItem,
} from "@finance/core/investment-positions";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

interface InvestmentsViewProps {
  portfolio: InvestmentPortfolioSummary;
  recurringTemplates: RecurringTemplateWithCategory[];
  fundingNeeds: WalletFundingNeed[];
  /** What each held instrument's price did, keyed by symbol. */
  priceSeries: Record<string, InstrumentPriceSeries>;
}

/** Module-level (not a hook), so it takes the caller's already-bound formatter. */
function formatSignedEuro(
  amount: number,
  format: (amount: number) => string,
): string {
  const formatted = format(Math.abs(amount));
  if (amount > 0) {
    return `+${formatted}`;
  }
  if (amount < 0) {
    return `−${formatted}`;
  }
  return formatted;
}

function defaultWalletTab(
  portfolio: InvestmentPortfolioSummary,
): InvestmentWalletId {
  const withItems = INVESTMENT_WALLET_IDS.find((walletId) => {
    const column = portfolio.columns.find(
      (entry) => entry.walletId === walletId,
    );
    return (column?.items.length ?? 0) > 0;
  });
  return withItems ?? "pea";
}

export function InvestmentsView({
  portfolio,
  recurringTemplates,
  fundingNeeds,
  priceSeries,
}: InvestmentsViewProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const [activeWallet, setActiveWallet] = useState<InvestmentWalletId>(() =>
    defaultWalletTab(portfolio),
  );
  const [editingItem, setEditingItem] = useState<InvestmentPositionItem | null>(
    null,
  );
  const [addingWallet, setAddingWallet] = useState<InvestmentWalletId | null>(
    null,
  );

  const trackedRecurringIds = useMemo(
    () =>
      new Set(
        portfolio.columns.flatMap((column) =>
          column.items
            .map((item) => item.recurringTemplateId)
            .filter((id): id is string => id !== null),
        ),
      ),
    [portfolio.columns],
  );

  const sheetOpen = editingItem !== null || addingWallet !== null;
  const sheetWallet = editingItem?.walletId ?? addingWallet ?? activeWallet;
  const recurringOptions = recurringTemplatesForWallet(
    sheetWallet,
    recurringTemplates,
    trackedRecurringIds,
  );

  const hasData = portfolioHasActivity(portfolio);
  const visibleFunding = fundingNeeds.filter((need) => need.monthlyTotal > 0);
  const showPl = portfolio.hasMarketSnapshot && portfolio.totalGainLoss !== 0;

  const activeColumn =
    portfolio.columns.find((entry) => entry.walletId === activeWallet) ??
    emptyColumn(activeWallet);

  return (
    <>
      <PageHeader titleKey="nav.wallets" />

      <PageContainer>
        {/* The tab strip belongs on both views, not just the new one — without
            it the look-through was reachable only from the sidebar, which is
            hidden on a phone. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SurfaceTabs tabs={WALLET_TABS} />
          <RefreshQuotesButton />
        </div>

        <Stagger
          className="flex w-full min-w-0 flex-col items-center gap-8 md:gap-10"
          stagger={0.05}
        >
          <StaggerItem className="w-full min-w-0">
            <StatHero
              label={t("wallets.marketValue")}
              amount={formatEuro(portfolio.totalMarketValue)}
              animateValue={portfolio.totalMarketValue}
              format={formatEuro}
              subtitle={
                <p>
                  <span className="privacy-amount">
                    {formatEuro(portfolio.totalInvested)}
                  </span>{" "}
                  {t("wallets.investedSuffix")}
                  {showPl ? (
                    <>
                      {" · "}
                      <span
                        className={cn(
                          "privacy-amount font-mono font-medium",
                          portfolio.totalGainLoss > 0
                            ? "text-success"
                            : "text-destructive",
                        )}
                      >
                        {formatSignedEuro(portfolio.totalGainLoss, formatEuro)}
                      </span>
                    </>
                  ) : null}
                </p>
              }
            />
          </StaggerItem>

          {visibleFunding.length > 0 ? (
            <StaggerItem className="w-full">
              {/* One row of tags rather than one sentence per wallet: three
                  lines of "Send to X €Y / month" is three lines of height for
                  three numbers, and the wallet name is label enough. */}
              <ul
                aria-label={t("wallets.fundingLabel")}
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {visibleFunding.map((need) => (
                  <li
                    key={need.walletId}
                    className="flex items-baseline gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:text-sm"
                  >
                    <span>{INVESTMENT_WALLET_LABELS[need.walletId]}</span>
                    <span className="privacy-amount font-mono font-medium text-foreground tabular-nums">
                      {formatEuro(need.monthlyTotal)}
                    </span>
                    <span>{t("wallets.perMonth")}</span>
                  </li>
                ))}
              </ul>
            </StaggerItem>
          ) : null}

          {!hasData ? (
            <StaggerItem className="w-full">
              <EmptyState
                title={t("wallets.emptyTitle")}
                description={t("wallets.emptyBody")}
              />
            </StaggerItem>
          ) : null}

          <StaggerItem className="w-full min-w-0">
            <div
              className="flex w-full min-w-0 flex-wrap justify-center gap-2"
              role="tablist"
              aria-label={t("wallets.walletPicker")}
            >
              {INVESTMENT_WALLET_IDS.map((walletId) => {
                const active = activeWallet === walletId;

                return (
                  <button
                    key={walletId}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveWallet(walletId)}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold",
                      "transition-colors duration-300",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {INVESTMENT_WALLET_LABELS[walletId]}
                  </button>
                );
              })}
            </div>
          </StaggerItem>

          <StaggerItem className="w-full min-w-0">
            <WalletPanel
              column={activeColumn}
              priceSeries={priceSeries}
              onEdit={setEditingItem}
              onAdd={() => setAddingWallet(activeWallet)}
            />
          </StaggerItem>
        </Stagger>
      </PageContainer>

      <InvestmentPositionSheet
        item={editingItem}
        walletId={sheetWallet}
        recurringOptions={recurringOptions}
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            setAddingWallet(null);
          }
        }}
      />
    </>
  );
}

function emptyColumn(walletId: InvestmentWalletId): InvestmentColumnSummary {
  return {
    walletId,
    items: [],
    totalInvested: 0,
    totalMarketValue: 0,
    totalGainLoss: 0,
    hasMarketSnapshot: false,
    chartPoints: [],
  };
}

interface WalletPanelProps {
  column: InvestmentColumnSummary;
  priceSeries: Record<string, InstrumentPriceSeries>;
  onEdit: (item: InvestmentPositionItem) => void;
  onAdd: () => void;
}

/** "1M", "1Y", "5Y" read the same in both languages; only "All" is a word. */
function rangeLabel(range: PriceRange, allLabel: string): string {
  return range === "ALL" ? allLabel : range;
}

function WalletPanel({
  column,
  priceSeries,
  onEdit,
  onAdd,
}: WalletPanelProps) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const showPl = column.hasMarketSnapshot && column.totalGainLoss !== 0;
  const [range, setRange] = useState<PriceRange>("1Y");

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
              showPl ? formatSignedEuro(column.totalGainLoss, formatEuro) : "—"
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

        {anyDrawable ? (
          <SegmentedControl
            segments={rangeSegments}
            value={range}
            onChange={setRange}
            label={t("common.chartRange")}
            className="mb-3 ml-auto w-full max-w-[15rem]"
          />
        ) : null}

        {column.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("wallets.noItems")}
          </p>
        ) : (
          <ul className="flex min-w-0 flex-col divide-y divide-border">
            {column.items.map((item) => (
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
    </Card.Bezel>
  );
}

interface InvestmentPositionRowProps {
  item: InvestmentPositionItem;
  /** Absent for a holding with no linked instrument — it simply has no line. */
  series: InstrumentPriceSeries | undefined;
  range: PriceRange;
  onEdit: () => void;
}

function InvestmentPositionRow({
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
              <p className="mt-1 text-xs font-medium text-primary-ink">
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
          <InlineMetric label={valueLabel} value={formatEuro(item.marketValue)} />
          <InlineMetric
            label={t("wallets.invested")}
            value={formatEuro(item.totalInvested)}
          />
          <InlineMetric
            label={t("wallets.profitLoss")}
            value={formatSignedEuro(item.gainLoss, formatEuro)}
            suffix={
              returnPct === null ? undefined : formatSignedPercent(returnPct, locale)
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

interface InlineMetricProps {
  label: string;
  value: string;
  /** A second figure that restates the first — the return beside the euros. */
  suffix?: string;
  tone?: "positive" | "negative" | "neutral";
}

/**
 * A label and its figure on one baseline.
 *
 * The stacked `Metric` is right for the wallet totals, where three figures get
 * a column each and the eye compares down. In a list of holdings it spends two
 * lines on what reads perfectly well as one.
 */
function InlineMetric({
  label,
  value,
  suffix,
  tone = "neutral",
}: InlineMetricProps) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "privacy-amount font-mono font-medium tabular-nums",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </span>
      {suffix ? (
        <span
          className={cn(
            "privacy-amount font-mono tabular-nums",
            tone === "positive" && "text-success",
            tone === "negative" && "text-destructive",
            tone === "neutral" && "text-muted-foreground",
          )}
        >
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

const PRICE_TONE_VARS: Record<
  "positive" | "negative" | "neutral",
  string
> = {
  positive: "--success",
  negative: "--destructive",
  neutral: "--muted-foreground",
};

interface MetricProps {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  className?: string;
}

function Metric({ label, value, tone = "neutral", className }: MetricProps) {
  return (
    <div className={cn("min-w-0 text-center", className)}>
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p
        className={cn(
          "privacy-amount mt-0.5 truncate font-mono text-sm font-semibold tabular-nums sm:text-base",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
