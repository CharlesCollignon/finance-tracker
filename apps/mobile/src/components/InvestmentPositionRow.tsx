import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { InvestmentPositionItem } from "@finance/core/investment-positions";
import { isCryptoWallet } from "@finance/core/crypto-holdings";
import {
  formatSignedPercent,
  type RangeSeries,
} from "@finance/core/instrument-price-series";

import { InstrumentLogo } from "@/components/InstrumentLogo";
import { PriceSparkline } from "@/components/PriceSparkline";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { formatSigned } from "@finance/core/amount-sign";

interface InvestmentPositionRowProps {
  item: InvestmentPositionItem;
  /** The instrument's own price over a year, once it has been read. */
  priceLine?: RangeSeries;
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

/**
 * One wallet position: its mark, what it is, the three figures — and behind
 * them, faintly, the instrument's own price over a year, with its move said
 * once beside the name. The web's row, at phone width.
 */
export function InvestmentPositionRow({
  item,
  priceLine,
  onEdit,
}: InvestmentPositionRowProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  const isCrypto = isCryptoWallet(item.walletId);
  const valueLabel =
    item.hasManualValue || item.hasMarketQuote
      ? t("wallets.market")
      : t("wallets.invested");
  const hasLine = (priceLine?.values.length ?? 0) > 1;
  const change = priceLine?.changePct ?? null;
  const lineColor =
    change === null || change === 0
      ? colors.mutedForeground
      : change > 0
        ? colors.success
        : colors.destructive;

  return (
    <View className="min-w-0 py-4">
      {hasLine ? (
        <PriceSparkline
          values={priceLine!.values}
          color={lineColor}
          style={{ left: 0, right: 0, bottom: 6, height: 48 }}
        />
      ) : null}
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 flex-row items-start gap-2.5">
          <InstrumentLogo
            symbol={item.instrumentSymbol}
            fallbackIcon={item.icon}
          />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-sm font-medium">
              {item.name}
            </Text>
            {item.instrumentSymbol ? (
              <Text variant="muted" numberOfLines={1} className="text-xs">
                {isCrypto
                  ? t("position.bitcoin")
                  : (item.instrumentName ?? item.instrumentSymbol)}
              </Text>
            ) : null}
            {hasLine && change !== null ? (
              <Text
                numberOfLines={1}
                className={cn(
                  "text-xs font-medium",
                  change > 0
                    ? "text-success"
                    : change < 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {t("wallets.priceOverYear", {
                  change: formatSignedPercent(change, locale),
                })}
              </Text>
            ) : null}
            {item.needsShareCount ? (
              <Text className="mt-1 text-xs font-medium text-primary-ink">
                {isCrypto
                  ? t("wallets.addBtcForValue")
                  : t("wallets.addSharesForValue")}
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("wallets.editPosition", { name: item.name })}
          onPress={onEdit}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons
            name="pencil-outline"
            size={ICON.md}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View className="mt-3 flex-row gap-2">
        <Metric label={valueLabel} value={formatEuro(item.marketValue)} />
        <Metric
          label={t("wallets.invested")}
          value={formatEuro(item.totalInvested)}
        />
        <Metric
          label={t("wallets.profitLoss")}
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
    </View>
  );
}
