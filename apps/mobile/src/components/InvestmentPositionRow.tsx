import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { EChartsCoreOption } from "echarts/core";

import type { InvestmentPositionItem } from "@finance/core/investment-positions";
import { isCryptoWallet } from "@finance/core/crypto-holdings";

import { CategoryIcon } from "@/components/CategoryIcon";
import { EChart } from "@/components/charts/EChart";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface InvestmentPositionRowProps {
  item: InvestmentPositionItem;
  onEdit: () => void;
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <View className="min-w-0 flex-1">
      <Text variant="muted" className="text-[10px] uppercase">
        {label}
      </Text>
      <PrivateAmount
        numberOfLines={1}
        className={cn(
          "font-mono text-xs font-semibold",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </PrivateAmount>
    </View>
  );
}

function formatSigned(amount: number, format: (v: number) => string): string {
  const formatted = format(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

/** One wallet position: identity, the three metrics, and an optional chart. */
export function InvestmentPositionRow({
  item,
  onEdit,
}: InvestmentPositionRowProps) {
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const [chartOpen, setChartOpen] = useState(false);

  const isCrypto = isCryptoWallet(item.walletId);
  const valueLabel =
    item.hasManualValue || item.hasMarketQuote ? "Market" : "Invested";
  const hasChart = item.chartPoints.length > 0;

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!hasChart) {
      return null;
    }
    const line = item.gainLoss < 0 ? colors.destructive : colors.success;
    return {
      animationDuration: 300,
      grid: { left: 8, right: 8, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: item.chartPoints.map((point) => point.label),
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
          name: "Invested",
          smooth: true,
          showSymbol: false,
          lineStyle: { color: colors.mutedForeground, width: 1.5 },
          itemStyle: { color: colors.mutedForeground },
          data: item.chartPoints.map((point) => point.invested),
        },
        {
          type: "line",
          name: "Market",
          smooth: true,
          showSymbol: false,
          lineStyle: { color: line, width: 2 },
          itemStyle: { color: line },
          data: item.chartPoints.map((point) => point.market),
        },
      ],
    };
  }, [colors, hasChart, item.chartPoints, item.gainLoss]);

  return (
    <View className="min-w-0 py-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-start gap-2">
          <CategoryIcon icon={item.icon} className="h-8 w-8" />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-sm font-medium">
              {item.name}
            </Text>
            {item.instrumentSymbol ? (
              <Text variant="muted" numberOfLines={1} className="text-xs">
                {isCrypto
                  ? "Bitcoin"
                  : (item.instrumentName ?? item.instrumentSymbol)}
              </Text>
            ) : null}
            {item.needsShareCount ? (
              <Text className="mt-1 text-xs font-medium text-primary">
                {isCrypto
                  ? "Add total BTC for live market value"
                  : "Add total shares for live market value"}
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          onPress={onEdit}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons
            name="pencil-outline"
            size={16}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View className="mt-3 flex-row gap-2">
        <Metric label={valueLabel} value={formatEuro(item.marketValue)} />
        <Metric label="Invested" value={formatEuro(item.totalInvested)} />
        <Metric
          label="P/L"
          value={formatSigned(item.gainLoss, formatEuro)}
          tone={
            item.gainLoss > 0
              ? "positive"
              : item.gainLoss < 0
                ? "negative"
                : "neutral"
          }
        />
      </View>

      {hasChart ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setChartOpen((open) => !open)}
          className="mt-2 min-h-11 justify-center"
        >
          <Text variant="muted" className="text-xs font-medium">
            {chartOpen ? "Hide chart" : "Show chart"}
          </Text>
        </Pressable>
      ) : null}

      {chartOpen && option ? (
        <EChart option={option} height={160} className="mt-1" />
      ) : null}
    </View>
  );
}
