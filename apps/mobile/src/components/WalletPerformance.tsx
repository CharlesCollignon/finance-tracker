import { useMemo, useState } from "react";
import { View } from "react-native";
import type { EChartsCoreOption } from "echarts/core";

import type { InvestmentWalletId } from "@finance/core/investments";
import { isCryptoWallet } from "@finance/core/crypto-holdings";
import type {
  InvestmentPortfolioSummary,
  PositionChartPoint,
} from "@finance/core/investment-positions";
import type { UpcomingInvestment } from "@finance/core/investment-upcoming";

import { EChart } from "@/components/charts/EChart";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { useT, useLocale } from "@/providers/LocaleProvider";
import { formatSignedPercentOf } from "@finance/core/constants";
import { INTL_LOCALES } from "@finance/core/i18n/locale";
import { formatSigned } from "@finance/core/amount-sign";

interface WalletPerformanceProps {
  portfolio: InvestmentPortfolioSummary;
  activeWallet: InvestmentWalletId;
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

/** "1D" is English; French shortens a day, a week and a year differently. */
const RANGE_LABEL_KEY = {
  "1D": "wallets.range1D",
  "1W": "wallets.range1W",
  "1M": "wallets.range1M",
  "3M": "wallets.range3M",
  "1Y": "wallets.range1Y",
  All: "wallets.rangeAll",
} as const satisfies Record<RangeKey, string>;

function slice(points: PositionChartPoint[], range: RangeKey) {
  const months = RANGE_MONTHS[range];
  return months >= points.length ? points : points.slice(-months);
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
          "mt-0.5 font-sans tabular-nums text-base font-semibold",
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
          "font-sans tabular-nums text-sm font-semibold",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </PrivateAmount>
    </View>
  );
}

/**
 * One wallet's performance: headline metrics, chart, then the detail. The
 * wallet is chosen on the screen above, which also lists its positions.
 */
export function WalletPerformance({
  portfolio,
  activeWallet,
  nextByWallet,
}: WalletPerformanceProps) {
  const t = useT();
  const locale = useLocale();
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
          name: t("wallets.marketValue"),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: colors.primary, width: 2 },
          itemStyle: { color: colors.primary },
          data: visible.map((point) => point.market),
        },
        {
          type: "line",
          name: t("wallets.invested"),
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
  }, [visible, colors, t]);

  return (
    <View className="gap-4">
      <View className="flex-row gap-3">
        <Metric
          label={t("wallets.marketValue")}
          value={formatEuro(marketValue)}
          color={colors.primary}
        />
        <Metric
          label={t("wallets.invested")}
          value={formatEuro(invested)}
          color={colors.mutedForeground}
        />
        <Metric
          label={isCrypto ? t("position.bitcoin") : t("position.shares")}
          value={
            holdings > 0
              ? isCrypto
                ? `${new Intl.NumberFormat(INTL_LOCALES[locale], {
                    maximumFractionDigits: 8,
                  }).format(holdings)} ₿`
                : new Intl.NumberFormat(INTL_LOCALES[locale], {
                    maximumFractionDigits: 4,
                  }).format(holdings)
              : "—"
          }
        />
      </View>

      {option ? (
        <EChart option={option} height={200} />
      ) : (
        <Card bezel innerClassName="items-center p-5">
          <Text variant="muted" className="text-center text-sm">
            {points.length === 0
              ? t("position.noHistory")
              : t("position.oneMonthOnly")}
          </Text>
        </Card>
      )}

      <SegmentedControl
        label={t("position.chartRange")}
        value={range}
        onChange={setRange}
        segments={RANGES.map((key) => ({
          value: key,
          label: t(RANGE_LABEL_KEY[key]),
          disabled: slice(points, key).length < 2 && key !== "All",
        }))}
      />

      <Card bezel innerClassName="px-4 py-1">
        <StatRow
          label={t("position.totalInvested")}
          value={formatEuro(invested)}
        />
        <View className="h-px bg-border" />
        <StatRow
          label={
            isCrypto
              ? t("position.averageBuyPrice")
              : t("position.averageSharePrice")
          }
          value={avgBuyPrice !== null ? formatEuro(avgBuyPrice) : "—"}
        />
        <View className="h-px bg-border" />
        <StatRow
          label={t("position.averageMonthly")}
          value={avgMonthly !== null ? formatEuro(avgMonthly) : "—"}
        />
        <View className="h-px bg-border" />
        <StatRow
          label={t("position.nextContribution")}
          value={next ? `${next.dateLabel} · ${formatEuro(next.amount)}` : "—"}
        />
        <View className="h-px bg-border" />
        <StatRow
          label={t("position.returnAmount")}
          value={formatSigned(gainLoss, formatEuro)}
          tone={
            gainLoss > 0 ? "positive" : gainLoss < 0 ? "negative" : undefined
          }
        />
        <View className="h-px bg-border" />
        <StatRow
          label={t("position.returnPercent")}
          value={
            returnPct !== null
              ? formatSignedPercentOf(returnPct / 100, locale, 2)
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
