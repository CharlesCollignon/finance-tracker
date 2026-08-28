import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { EChartsCoreOption } from "echarts/core";

import {
  INVESTMENT_WALLET_IDS,
  INVESTMENT_WALLET_LABELS,
  type InvestmentWalletId,
} from "@finance/core/investments";
import { isCryptoWallet } from "@finance/core/crypto-holdings";
import type {
  InvestmentPortfolioSummary,
  PositionChartPoint,
} from "@finance/core/investment-positions";
import type { UpcomingInvestment } from "@finance/core/investment-upcoming";

import { EChart } from "@/components/charts/EChart";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface WalletPerformanceProps {
  portfolio: InvestmentPortfolioSummary;
  activeWallet: InvestmentWalletId;
  onWalletChange: (wallet: InvestmentWalletId) => void;
  nextByWallet: Partial<Record<InvestmentWalletId, UpcomingInvestment>>;
}

type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "All";

/**
 * Months of history each range covers. Position values are computed per month,
 * so anything below a month resolves to the same single point — those buttons
 * are shown (they were asked for) but disabled when they cannot draw a line.
 */
const RANGE_MONTHS: Record<RangeKey, number> = {
  "1D": 1,
  "1W": 1,
  "1M": 1,
  "3M": 3,
  "1Y": 12,
  All: Number.MAX_SAFE_INTEGER,
};

const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "All"];

function slice(points: PositionChartPoint[], range: RangeKey) {
  const months = RANGE_MONTHS[range];
  return months >= points.length ? points : points.slice(-months);
}

function formatSigned(amount: number, format: (v: number) => string): string {
  const formatted = format(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

/** Metric with the colour bar tying it to its line on the chart. */
function Metric({
  label,
  value,
  color,
  tone,
}: {
  label: string;
  value: string;
  color?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <View className="min-w-0 flex-1">
      <Text variant="muted" numberOfLines={1} className="text-xs">
        {label}
      </Text>
      <PrivateAmount
        numberOfLines={1}
        className={cn(
          "mt-0.5 font-mono text-base font-semibold",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </PrivateAmount>
      {color ? (
        <View
          className="mt-1.5 h-0.5 w-6 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
    </View>
  );
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-3">
      <Text className="flex-1 text-sm">{label}</Text>
      <PrivateAmount
        className={cn(
          "font-mono text-sm font-semibold",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </PrivateAmount>
    </View>
  );
}

/** Per-wallet performance: tabs, headline metrics, chart, then the detail. */
export function WalletPerformance({
  portfolio,
  activeWallet,
  onWalletChange,
  nextByWallet,
}: WalletPerformanceProps) {
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const [range, setRange] = useState<RangeKey>("All");

  const column = portfolio.columns.find(
    (entry) => entry.walletId === activeWallet,
  );
  const isCrypto = isCryptoWallet(activeWallet);
  const points = useMemo(() => column?.chartPoints ?? [], [column]);
  const visible = useMemo(() => slice(points, range), [points, range]);

  const holdings = (column?.items ?? []).reduce(
    (total, item) => total + (item.shareCount ?? 0),
    0,
  );
  const invested = column?.totalInvested ?? 0;
  const marketValue = column?.totalMarketValue ?? 0;
  const gainLoss = column?.totalGainLoss ?? 0;
  const returnPct = invested > 0 ? (gainLoss / invested) * 100 : null;
  const avgBuyPrice = holdings > 0 ? invested / holdings : null;
  const monthsWithActivity = points.filter((p) => p.invested > 0).length;
  const avgMonthly =
    monthsWithActivity > 0 ? invested / monthsWithActivity : null;
  const next = nextByWallet[activeWallet];

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (visible.length < 2) {
      return null;
    }
    return {
      animationDuration: 400,
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      // Tap shows the values at that point; dragging moves the crosshair.
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          lineStyle: { color: colors.mutedForeground },
        },
        backgroundColor: colors.card,
        borderColor: colors.border,
        textStyle: { color: colors.foreground, fontSize: 11 },
      },
      xAxis: {
        type: "category",
        data: visible.map((point) => point.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: colors.mutedForeground, fontSize: 9 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: colors.border, type: "dashed" } },
        axisLabel: { color: colors.mutedForeground, fontSize: 9 },
      },
      series: [
        {
          type: "line",
          name: "Market value",
          smooth: true,
          showSymbol: false,
          lineStyle: { color: colors.primary, width: 2 },
          itemStyle: { color: colors.primary },
          data: visible.map((point) => point.market),
        },
        {
          type: "line",
          name: "Invested",
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: colors.mutedForeground,
            width: 1.5,
            type: "dashed",
          },
          itemStyle: { color: colors.mutedForeground },
          data: visible.map((point) => point.invested),
        },
      ],
    };
  }, [visible, colors]);

  return (
    <View className="gap-4">
      <View className="flex-row gap-2">
        {INVESTMENT_WALLET_IDS.map((walletId) => {
          const selected = walletId === activeWallet;
          return (
            <Pressable
              key={walletId}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                void hapticLight();
                onWalletChange(walletId);
              }}
              className={cn(
                "flex-1 rounded-full border px-3 py-2",
                selected
                  ? "border-foreground bg-foreground"
                  : "border-border bg-background",
              )}
            >
              <Text
                numberOfLines={1}
                className={cn(
                  "text-center text-sm font-semibold",
                  selected ? "text-background" : "text-muted-foreground",
                )}
              >
                {INVESTMENT_WALLET_LABELS[walletId]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row gap-3">
        <Metric
          label="Market value"
          value={formatEuro(marketValue)}
          color={colors.primary}
        />
        <Metric
          label="Invested"
          value={formatEuro(invested)}
          color={colors.mutedForeground}
        />
        <Metric
          label={isCrypto ? "Bitcoin" : "Shares"}
          value={
            holdings > 0
              ? isCrypto
                ? `${holdings.toFixed(8)} ₿`
                : String(holdings)
              : "—"
          }
        />
      </View>

      {option ? (
        <EChart option={option} height={200} />
      ) : (
        <Card bezel innerClassName="items-center p-6">
          <Text variant="muted" className="text-center text-sm">
            {points.length === 0
              ? "No history for this wallet yet."
              : "One month of history so far — a line needs at least two."}
          </Text>
        </Card>
      )}

      <View className="flex-row flex-wrap justify-center gap-2">
        {RANGES.map((key) => {
          const selected = range === key;
          const enabled = slice(points, key).length >= 2 || key === "All";
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !enabled }}
              disabled={!enabled}
              onPress={() => {
                void hapticLight();
                setRange(key);
              }}
              className={cn(
                "rounded-full px-3 py-1.5",
                selected ? "bg-muted" : "bg-transparent",
                !enabled && "opacity-30",
              )}
            >
              <Text
                className={cn(
                  "text-xs font-semibold",
                  selected ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {key}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card bezel innerClassName="px-4 py-1">
        <StatRow label="Total invested" value={formatEuro(invested)} />
        <View className="h-px bg-border" />
        <StatRow
          label={isCrypto ? "Average buy price" : "Average share price"}
          value={avgBuyPrice !== null ? formatEuro(avgBuyPrice) : "—"}
        />
        <View className="h-px bg-border" />
        <StatRow
          label="Average monthly contribution"
          value={avgMonthly !== null ? formatEuro(avgMonthly) : "—"}
        />
        <View className="h-px bg-border" />
        <StatRow
          label="Next contribution"
          value={next ? `${next.dateLabel} · ${formatEuro(next.amount)}` : "—"}
        />
        <View className="h-px bg-border" />
        <StatRow
          label="Return"
          value={formatSigned(gainLoss, formatEuro)}
          tone={
            gainLoss > 0 ? "positive" : gainLoss < 0 ? "negative" : undefined
          }
        />
        <View className="h-px bg-border" />
        <StatRow
          label="Return %"
          value={
            returnPct !== null
              ? `${returnPct >= 0 ? "+" : "−"}${Math.abs(returnPct).toFixed(2)} %`
              : "—"
          }
          tone={
            returnPct === null
              ? undefined
              : returnPct > 0
                ? "positive"
                : returnPct < 0
                  ? "negative"
                  : undefined
          }
        />
      </Card>
    </View>
  );
}
