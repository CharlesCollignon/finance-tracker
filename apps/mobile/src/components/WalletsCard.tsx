import { useMemo } from "react";
import { Pressable, useColorScheme, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { EChartsCoreOption } from "echarts/core";

import {
  INVESTMENT_WALLET_IDS,
  INVESTMENT_WALLET_LABELS,
} from "@finance/core/investments";
import {
  portfolioHasActivity,
  type InvestmentPortfolioSummary,
} from "@finance/core/investment-positions";

import { EChart } from "@/components/charts/EChart";
import { PrivateAmount } from "@/components/PrivateAmount";
import { StatHero } from "@/components/StatHero";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { chartPalette } from "@/theme/echarts";
import { useThemeColors } from "@/theme/useThemeColors";

interface WalletsCardProps {
  portfolio: InvestmentPortfolioSummary;
}

function formatSigned(
  amount: number,
  format: (value: number) => string,
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

/** Wallet allocation: total, invested/P–L line, donut and a per-wallet legend. */
export function WalletsCard({ portfolio }: WalletsCardProps) {
  const router = useRouter();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const scheme = useColorScheme();
  const palette = chartPalette(scheme === "light" ? "light" : "dark");

  const hasData = portfolioHasActivity(portfolio);
  const pl = portfolio.totalGainLoss;
  const showPl = portfolio.hasMarketSnapshot && pl !== 0;

  const slices = useMemo(
    () =>
      INVESTMENT_WALLET_IDS.map((walletId, index) => {
        const column = portfolio.columns.find(
          (entry) => entry.walletId === walletId,
        );
        return {
          id: walletId,
          label: INVESTMENT_WALLET_LABELS[walletId],
          value: column?.totalMarketValue ?? 0,
          color: palette[index % palette.length] ?? colors.primary,
        };
      }).filter((slice) => slice.value > 0),
    [portfolio.columns, palette, colors.primary],
  );

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (slices.length === 0) {
      return null;
    }
    return {
      animationDuration: 450,
      series: [
        {
          type: "pie",
          radius: ["58%", "78%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          data: slices.map((slice) => ({
            name: slice.label,
            value: slice.value,
            itemStyle: { color: slice.color },
          })),
        },
      ],
    };
  }, [slices]);

  const header = (
    <View className="flex-row items-center justify-center gap-2">
      <Text className="text-sm font-medium text-muted-foreground">Wallets</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open wallets"
        onPress={() => router.push("/investments")}
        hitSlop={8}
      >
        <Ionicons
          name="arrow-forward"
          size={14}
          color={colors.mutedForeground}
        />
      </Pressable>
    </View>
  );

  if (!hasData) {
    return (
      <View className="w-full items-center">
        {header}
        <Text variant="muted" className="mt-2 text-sm">
          No positions yet
        </Text>
      </View>
    );
  }

  return (
    <View className="w-full items-center">
      {header}
      <StatHero
        className="mt-1"
        label=""
        size="md"
        amount={formatEuro(portfolio.totalMarketValue)}
        subtitle={
          <>
            {`${formatEuro(portfolio.totalInvested)} invested`}
            {showPl ? (
              <Text
                className={
                  pl > 0
                    ? "text-sm font-medium text-success"
                    : "text-sm font-medium text-destructive"
                }
              >
                {` · ${formatSigned(pl, formatEuro)}`}
              </Text>
            ) : null}
          </>
        }
      />
      {option ? (
        <EChart option={option} height={150} className="mt-2 max-w-xs" />
      ) : null}
      <View className="mt-1 w-full max-w-xs gap-1">
        {slices.map((slice) => (
          <View
            key={slice.id}
            className="flex-row items-center justify-between gap-2"
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <View
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <Text numberOfLines={1} className="flex-1 text-sm">
                {slice.label}
              </Text>
            </View>
            <PrivateAmount className="font-mono text-sm font-medium">
              {formatEuro(slice.value)}
            </PrivateAmount>
          </View>
        ))}
      </View>
    </View>
  );
}
