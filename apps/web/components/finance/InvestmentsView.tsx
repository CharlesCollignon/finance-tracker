"use client";

import { useMemo, useState } from "react";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { InvestmentItemChart } from "@/components/finance/InvestmentItemChart";
import { InvestmentPositionSheet } from "@/components/finance/InvestmentPositionSheet";
import { formatBtcAmount, isCryptoWallet } from "@finance/core/crypto-holdings";
import { formatEuro } from "@finance/core/constants";
import type {
  UpcomingInvestment,
  WalletFundingNeed,
} from "@finance/core/investment-upcoming";
import {
  INVESTMENT_WALLET_COLORS,
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
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";

interface InvestmentsViewProps {
  portfolio: InvestmentPortfolioSummary;
  recurringTemplates: RecurringTemplateWithCategory[];
  nextUpcomingByWallet: Partial<Record<InvestmentWalletId, UpcomingInvestment>>;
  fundingNeeds: WalletFundingNeed[];
}

function formatSignedEuro(amount: number): string {
  const formatted = formatEuro(Math.abs(amount));
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
  nextUpcomingByWallet,
  fundingNeeds,
}: InvestmentsViewProps) {
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

  const activeColumn =
    portfolio.columns.find((entry) => entry.walletId === activeWallet) ??
    emptyColumn(activeWallet);

  return (
    <>
      <PageHeader title="Wallets">
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        <Card
          className={cn(
            "border p-5 text-center md:p-6",
            "border-[var(--chart-3)] bg-[var(--chart-3)]/10",
          )}
        >
          <p className="font-head text-sm uppercase tracking-wide text-muted-foreground">
            Total portfolio
          </p>
          <p className="mt-2 font-head text-3xl tabular-nums font-semibold md:text-4xl">
            {formatEuro(portfolio.totalMarketValue)}
          </p>
          <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
            <p>
              Invested to date{" "}
              <span className="font-medium text-foreground">
                {formatEuro(portfolio.totalInvested)}
              </span>
            </p>
            {portfolio.hasMarketSnapshot && portfolio.totalGainLoss !== 0 && (
              <p>
                Unrealised P/L{" "}
                <span
                  className={cn(
                    "font-semibold",
                    portfolio.totalGainLoss > 0
                      ? "text-[var(--chart-4)]"
                      : "text-destructive",
                  )}
                >
                  {formatSignedEuro(portfolio.totalGainLoss)}
                </span>
              </p>
            )}
          </div>
        </Card>

        {visibleFunding.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleFunding.map((need) => (
              <Card
                key={need.walletId}
                className="border border-border p-4 md:p-5"
              >
                <p className="text-sm text-muted-foreground">
                  Send to {INVESTMENT_WALLET_LABELS[need.walletId]}
                </p>
                <p className="mt-1 font-head text-2xl tabular-nums font-semibold">
                  {formatEuro(need.monthlyTotal)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / month
                  </span>
                </p>
              </Card>
            ))}
          </div>
        )}

        {!hasData && (
          <EmptyState
            title="No investments tracked yet"
            description="Add items in each wallet to track what you already invested and your current market value."
          />
        )}

        <div
          className="flex rounded border border-border p-0.5"
          role="tablist"
          aria-label="Investment wallet"
        >
          {INVESTMENT_WALLET_IDS.map((walletId) => {
            const active = activeWallet === walletId;
            const accent = INVESTMENT_WALLET_COLORS[walletId];

            return (
              <button
                key={walletId}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveWallet(walletId)}
                className={cn(
                  "flex-1 rounded px-3 py-2 font-head text-sm font-medium transition-colors",
                  active
                    ? "text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={active ? { backgroundColor: accent } : undefined}
              >
                {INVESTMENT_WALLET_LABELS[walletId]}
              </button>
            );
          })}
        </div>

        <WalletPanel
          column={activeColumn}
          nextUpcoming={nextUpcomingByWallet[activeWallet] ?? null}
          onEdit={setEditingItem}
          onAdd={() => setAddingWallet(activeWallet)}
        />
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
  nextUpcoming: UpcomingInvestment | null;
  onEdit: (item: InvestmentPositionItem) => void;
  onAdd: () => void;
}

function WalletPanel({
  column,
  nextUpcoming,
  onEdit,
  onAdd,
}: WalletPanelProps) {
  const accent = INVESTMENT_WALLET_COLORS[column.walletId];
  const showPl = column.hasMarketSnapshot && column.totalGainLoss !== 0;

  return (
    <Card
      className="flex flex-col gap-5 p-4 md:p-6"
      style={{ borderTopColor: accent, borderTopWidth: 4 }}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-head text-xl">
            {INVESTMENT_WALLET_LABELS[column.walletId]}
          </h2>
          {nextUpcoming && (
            <p className="mt-1 text-sm text-muted-foreground">
              Next: {formatEuro(nextUpcoming.amount)} before{" "}
              {nextUpcoming.dateLabel}
            </p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:mt-0 sm:min-w-[18rem]">
          <Metric label="Value" value={formatEuro(column.totalMarketValue)} />
          <Metric label="Invested" value={formatEuro(column.totalInvested)} />
          <Metric
            label="P/L"
            value={showPl ? formatSignedEuro(column.totalGainLoss) : "—"}
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
        <p className="text-sm text-muted-foreground">
          No chart yet — add a position or link market data.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-head text-base">Positions</h3>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus size={16} />
            Add item
          </Button>
        </div>

        {column.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items yet in this wallet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {column.items.map((item) => (
              <li key={item.id}>
                <InvestmentPositionCard
                  item={item}
                  onEdit={() => onEdit(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

interface InvestmentPositionCardProps {
  item: InvestmentPositionItem;
  onEdit: () => void;
}

function InvestmentPositionCard({ item, onEdit }: InvestmentPositionCardProps) {
  const isCrypto = isCryptoWallet(item.walletId);
  const valueLabel =
    item.hasManualValue || item.hasMarketQuote ? "Market" : "Invested";

  return (
    <div className="rounded border border-border p-3 md:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <CategoryIcon icon={item.icon} className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium leading-snug">{item.name}</p>
            {item.instrumentSymbol && (
              <p className="truncate text-xs text-muted-foreground">
                {isCrypto
                  ? "Bitcoin"
                  : (item.instrumentName ?? item.instrumentSymbol)}
              </p>
            )}
            {item.needsShareCount && (
              <p className="mt-1 text-xs font-medium text-[var(--chart-3)]">
                {isCrypto
                  ? "Add total BTC for live market value"
                  : "Add total shares for live market value"}
              </p>
            )}
            {isCrypto && item.shareCount !== null && item.shareCount > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatBtcAmount(item.shareCount)}
              </p>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <PencilSimple size={16} />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm:text-sm">
        <Metric label={valueLabel} value={formatEuro(item.marketValue)} />
        <Metric label="Invested" value={formatEuro(item.totalInvested)} />
        <Metric
          label="P/L"
          value={formatSignedEuro(item.gainLoss)}
          tone={
            item.gainLoss > 0
              ? "positive"
              : item.gainLoss < 0
                ? "negative"
                : "neutral"
          }
        />
      </div>

      <InvestmentItemChart
        points={item.chartPoints}
        gainLoss={item.gainLoss}
        interactive
        className="mt-3"
      />
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
    <div className={className}>
      <p className="text-muted-foreground text-xs sm:text-sm">{label}</p>
      <p
        className={cn(
          "mt-0.5 tabular-nums font-semibold",
          "privacy-amount",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
