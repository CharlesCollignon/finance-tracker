"use client";

import { useMemo, useState } from "react";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { InstrumentLogo } from "@/components/finance/InstrumentLogo";
import { InvestmentItemChart } from "@/components/finance/lazy-charts";
import { InvestmentPositionSheet } from "@/components/finance/InvestmentPositionSheet";
import { StatHero } from "@/components/finance/StatHero";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { formatBtcAmount, isCryptoWallet } from "@finance/core/crypto-holdings";
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

interface InvestmentsViewProps {
  portfolio: InvestmentPortfolioSummary;
  recurringTemplates: RecurringTemplateWithCategory[];
  fundingNeeds: WalletFundingNeed[];
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
}: InvestmentsViewProps) {
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
      <PageHeader title="Wallets" />

      <PageContainer>
        <Stagger
          className="flex w-full min-w-0 flex-col items-center gap-8 md:gap-10"
          stagger={0.05}
        >
          <StaggerItem className="w-full min-w-0">
            <StatHero
              label="Market value"
              amount={formatEuro(portfolio.totalMarketValue)}
              subtitle={
                <p>
                  <span className="privacy-amount">
                    {formatEuro(portfolio.totalInvested)} invested
                  </span>
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
            <StaggerItem className="w-full space-y-1 text-center text-sm text-muted-foreground">
              {visibleFunding.map((need) => (
                <p key={need.walletId}>
                  Send to {INVESTMENT_WALLET_LABELS[need.walletId]}{" "}
                  <span className="privacy-amount font-mono font-medium text-foreground tabular-nums">
                    {formatEuro(need.monthlyTotal)}
                  </span>
                  <span> / month</span>
                </p>
              ))}
            </StaggerItem>
          ) : null}

          {!hasData ? (
            <StaggerItem className="w-full">
              <EmptyState
                title="No investments tracked yet"
                description="Add items in each wallet to track what you already invested and your current market value."
              />
            </StaggerItem>
          ) : null}

          <StaggerItem className="w-full min-w-0">
            <div
              className="flex w-full min-w-0 justify-center gap-2"
              role="tablist"
              aria-label="Investment wallet"
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
  onEdit: (item: InvestmentPositionItem) => void;
  onAdd: () => void;
}

function WalletPanel({ column, onEdit, onAdd }: WalletPanelProps) {
  const formatEuro = useFormatCurrency();
  const showPl = column.hasMarketSnapshot && column.totalGainLoss !== 0;

  return (
    <Card.Bezel
      className="w-full"
      innerClassName="flex w-full min-w-0 max-w-full flex-col gap-6 p-5 md:p-6"
    >
      <div className="flex min-w-0 flex-col items-center gap-3 text-center">
        <div className="grid w-full min-w-0 max-w-md grid-cols-3 gap-2 sm:gap-4">
          <Metric label="Value" value={formatEuro(column.totalMarketValue)} />
          <Metric label="Invested" value={formatEuro(column.totalInvested)} />
          <Metric
            label="P/L"
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

      {column.chartPoints.length > 0 ? (
        <InvestmentItemChart
          points={column.chartPoints}
          gainLoss={column.totalGainLoss}
          interactive
          size="lg"
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          No chart yet — add a position or link market data.
        </p>
      )}

      <div className="min-w-0">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Positions
          </h3>
          <Button size="sm" variant="link" onClick={onAdd}>
            <Plus size={16} weight="light" className="mr-1" />
            Add item
          </Button>
        </div>

        {column.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items yet in this wallet.
          </p>
        ) : (
          <ul className="flex min-w-0 flex-col divide-y divide-border">
            {column.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <InvestmentPositionRow
                  item={item}
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
  onEdit: () => void;
}

function InvestmentPositionRow({ item, onEdit }: InvestmentPositionRowProps) {
  const formatEuro = useFormatCurrency();
  const [chartOpen, setChartOpen] = useState(false);
  const isCrypto = isCryptoWallet(item.walletId);
  const valueLabel =
    item.hasManualValue || item.hasMarketQuote ? "Market" : "Invested";
  const hasChart = item.chartPoints.length > 0;

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
                  ? "Add total BTC for live market value"
                  : "Add total shares for live market value"}
              </p>
            ) : null}
            {isCrypto && item.shareCount !== null && item.shareCount > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatBtcAmount(item.shareCount)}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Edit ${item.name}`}
        >
          <PencilSimple size={16} weight="light" />
        </button>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-3 gap-2 text-xs sm:text-sm">
        <Metric label={valueLabel} value={formatEuro(item.marketValue)} />
        <Metric label="Invested" value={formatEuro(item.totalInvested)} />
        <Metric
          label="P/L"
          value={formatSignedEuro(item.gainLoss, formatEuro)}
          tone={
            item.gainLoss > 0
              ? "positive"
              : item.gainLoss < 0
                ? "negative"
                : "neutral"
          }
        />
      </div>

      {hasChart ? (
        <button
          type="button"
          onClick={() => setChartOpen((open) => !open)}
          className="mt-2 min-h-11 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {chartOpen ? "Hide chart" : "Show chart"}
        </button>
      ) : null}

      {chartOpen ? (
        <InvestmentItemChart
          points={item.chartPoints}
          gainLoss={item.gainLoss}
          interactive
          className="mt-3"
        />
      ) : null}
    </div>
  );
}

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
