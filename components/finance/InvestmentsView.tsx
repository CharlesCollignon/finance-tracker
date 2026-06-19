"use client";

import { useMemo, useState } from "react";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { InvestmentItemChart } from "@/components/finance/InvestmentItemChart";
import { InvestmentPositionSheet } from "@/components/finance/InvestmentPositionSheet";
import { formatEuro } from "@/lib/constants";
import {
  INVESTMENT_WALLET_COLORS,
  INVESTMENT_WALLET_LABELS,
  INVESTMENT_WALLET_IDS,
  type InvestmentWalletId,
} from "@/lib/investments";
import {
  portfolioHasActivity,
  recurringTemplatesForWallet,
  type InvestmentColumnSummary,
  type InvestmentPortfolioSummary,
  type InvestmentPositionItem,
} from "@/lib/investment-positions";
import { cn } from "@/lib/utils";
import type { RecurringTemplateWithCategory } from "@/lib/types/database";

interface InvestmentsViewProps {
  portfolio: InvestmentPortfolioSummary;
  recurringTemplates: RecurringTemplateWithCategory[];
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

export function InvestmentsView({
  portfolio,
  recurringTemplates,
}: InvestmentsViewProps) {
  const [editingItem, setEditingItem] =
    useState<InvestmentPositionItem | null>(null);
  const [addingWallet, setAddingWallet] =
    useState<InvestmentWalletId | null>(null);

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
  const sheetWallet = editingItem?.walletId ?? addingWallet ?? "pea";
  const recurringOptions = recurringTemplatesForWallet(
    sheetWallet,
    recurringTemplates,
    trackedRecurringIds,
  );

  const hasData = portfolioHasActivity(portfolio);

  return (
    <>
      <PageHeader title="Investments">
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        <Card
          className={cn(
            "border-2 p-5 text-center md:p-6",
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
              Total invested{" "}
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

        {!hasData && (
          <p className="text-sm text-muted-foreground">
            Add items in each column to track what you already invested
            and your current market value.
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {INVESTMENT_WALLET_IDS.map((walletId) => {
            const column =
              portfolio.columns.find((entry) => entry.walletId === walletId) ??
              emptyColumn(walletId);

            return (
              <InvestmentWalletColumn
                key={walletId}
                column={column}
                onEdit={setEditingItem}
                onAdd={() => setAddingWallet(walletId)}
              />
            );
          })}
        </div>
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

interface InvestmentWalletColumnProps {
  column: InvestmentColumnSummary;
  onEdit: (item: InvestmentPositionItem) => void;
  onAdd: () => void;
}

function InvestmentWalletColumn({
  column,
  onEdit,
  onAdd,
}: InvestmentWalletColumnProps) {
  const accent = INVESTMENT_WALLET_COLORS[column.walletId];

  return (
    <Card
      className="flex flex-col gap-3 p-4 md:p-5"
      style={{ borderTopColor: accent, borderTopWidth: 4 }}
    >
      <div>
        <h2 className="font-head text-lg">
          {INVESTMENT_WALLET_LABELS[column.walletId]}
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <Metric label="Value" value={formatEuro(column.totalMarketValue)} />
          <Metric label="Invested" value={formatEuro(column.totalInvested)} />
          {column.hasMarketSnapshot && column.totalGainLoss !== 0 && (
            <Metric
              label="P/L"
              value={formatSignedEuro(column.totalGainLoss)}
              tone={
                column.totalGainLoss > 0
                  ? "positive"
                  : column.totalGainLoss < 0
                    ? "negative"
                    : "neutral"
              }
              className="col-span-2"
            />
          )}
        </div>
      </div>

      {column.chartPoints.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Column total</p>
          <InvestmentItemChart
            points={column.chartPoints}
            gainLoss={column.totalGainLoss}
          />
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {column.items.map((item) => (
          <li key={item.id}>
            <InvestmentPositionCard item={item} onEdit={() => onEdit(item)} />
          </li>
        ))}
      </ul>

      {column.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No items yet in this column.
        </p>
      )}

      <Button variant="outline" className="w-full" onClick={onAdd}>
        <Plus size={16} />
        Add item
      </Button>
    </Card>
  );
}

interface InvestmentPositionCardProps {
  item: InvestmentPositionItem;
  onEdit: () => void;
}

function InvestmentPositionCard({
  item,
  onEdit,
}: InvestmentPositionCardProps) {
  const valueLabel =
    item.hasManualValue || item.hasMarketQuote
      ? "Market"
      : "Invested";

  return (
    <div className="rounded border-2 border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <CategoryIcon icon={item.icon} className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium leading-snug">{item.name}</p>
            {item.instrumentSymbol && (
              <p className="truncate text-xs text-muted-foreground">
                {item.instrumentName ?? item.instrumentSymbol}
              </p>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <PencilSimple size={16} />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
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
        className="mt-2 h-28"
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

function Metric({
  label,
  value,
  tone = "neutral",
  className,
}: MetricProps) {
  return (
    <div className={className}>
      <p className="text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 tabular-nums font-semibold",
          tone === "positive" && "text-[var(--chart-4)]",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
