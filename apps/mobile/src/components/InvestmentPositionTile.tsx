import { Pressable, View } from "react-native";

import {
  positionReturnPct,
  type InvestmentPositionItem,
} from "@finance/core/investment-positions";
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
import { TYPE } from "@/theme/tokens";
import { useLocale, useT } from "@/providers/LocaleProvider";

interface InvestmentPositionTileProps {
  item: InvestmentPositionItem;
  /** The instrument's own price over a year, once it has been read. */
  priceLine?: RangeSeries;
  onEdit: () => void;
}

/**
 * One wallet position as a tile, two to a row (the owner's pick, November
 * 2026): its mark and its return at the top, its name, what it is worth in
 * the figure face, what went into it, and the instrument's price over a
 * year as a faint grey line at the foot.
 *
 * It replaced a row of three labelled figures with the price line drawn
 * under them, which read as columns of capitals over a chart. The line is
 * grey now and has the bottom of the tile to itself: coloured, it said
 * "up" in green beside a holding that had lost money, because the price of
 * a share and what someone made buying it over time are two questions.
 * Only the return is coloured.
 */
export function InvestmentPositionTile({
  item,
  priceLine,
  onEdit,
}: InvestmentPositionTileProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  const isCrypto = isCryptoWallet(item.walletId);
  const hasLine = (priceLine?.values.length ?? 0) > 1;
  const returnPct = positionReturnPct(item);

  return (
    // The whole tile opens the position, as a ledger row does.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("wallets.editPosition", { name: item.name })}
      onPress={onEdit}
      className="min-h-[150px] flex-1 gap-2.5 overflow-hidden rounded-card border border-border bg-card/70 p-3.5 active:opacity-70"
    >
      <View className="flex-row items-center justify-between gap-2">
        <InstrumentLogo
          symbol={item.instrumentSymbol}
          fallbackIcon={item.icon}
        />
        {returnPct !== null ? (
          <View
            className={cn(
              "rounded-full px-2 py-0.5",
              returnPct > 0
                ? "bg-success/15"
                : returnPct < 0
                  ? "bg-destructive/15"
                  : "bg-foreground/10",
            )}
          >
            <PrivateAmount
              className={cn(
                "text-xs font-semibold",
                returnPct > 0
                  ? "text-success"
                  : returnPct < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {formatSignedPercent(returnPct, locale)}
            </PrivateAmount>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={2} className="text-sm font-semibold leading-tight">
        {item.name}
      </Text>

      <View className="mt-auto gap-0.5">
        {item.needsShareCount ? (
          <Text className="text-xs font-medium text-primary-ink">
            {isCrypto
              ? t("wallets.addBtcForValue")
              : t("wallets.addSharesForValue")}
          </Text>
        ) : (
          <PrivateAmount
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[TYPE.figure, { fontSize: 21, letterSpacing: -0.6 }]}
          >
            {formatEuro(item.marketValue)}
          </PrivateAmount>
        )}
        <Text variant="muted" numberOfLines={1} className="text-xs">
          {t("wallets.invested")}{" "}
          <PrivateAmount className="text-xs text-muted-foreground">
            {formatEuro(item.totalInvested)}
          </PrivateAmount>
        </Text>
      </View>

      {/* Its room kept when there is no line, so the figures of two tiles
          side by side sit on one level. */}
      <View className="h-6">
        {hasLine ? (
          <PriceSparkline
            values={priceLine!.values}
            color={colors.mutedForeground}
            style={{ left: 0, right: 0, top: 0, bottom: 0 }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
