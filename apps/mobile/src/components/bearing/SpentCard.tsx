import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import {
  formatMonthLabel,
  formatPercentLabel,
  shiftMonth,
} from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { MyShareToggle } from "@/components/bearing/MyShareToggle";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import type { HomeMonth } from "@/lib/home-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import {
  EASING,
  GROW_DELAY_MS,
  GROW_MS,
  HomeCard,
} from "@/components/bearing/card-parts";

/* ------------------------------------------------------------ the spending */

export function SpentCard({ data }: { data: HomeMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { spent } = data;
  const current = data.balance.period === "current";
  const previous = shiftMonth(data.year, data.month, -1);
  const previousLabel = formatMonthLabel(previous.year, previous.month, locale);

  const comparison = (() => {
    if (spent.previous === null || spent.previous === 0) {
      return null;
    }
    const difference = spent.total - spent.previous;
    if (Math.abs(difference) < 1) {
      return {
        text: t("bearingMonth.spentSame", { month: previousLabel }),
        better: true,
      };
    }
    const amount = format(Math.abs(difference));
    const key =
      difference < 0
        ? current
          ? "bearingMonth.spentLessSoFar"
          : "bearingMonth.spentLess"
        : current
          ? "bearingMonth.spentMoreSoFar"
          : "bearingMonth.spentMore";
    return {
      text: t(key, { amount, month: previousLabel }),
      better: difference < 0,
    };
  })();

  return (
    <HomeCard
      icon="receipt-outline"
      title={t("bearingMonth.spent")}
      href="/transactions"
      hrefLabel={t("bearingMonth.seeInLedger")}
      action={data.myShare ? <MyShareToggle /> : null}
    >
      <AnimatedAmount
        value={spent.total}
        startFrom={0}
        format={format}
        style={TYPE.figure}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
      {data.myShare?.on && data.myShare.part !== null ? (
        <Text variant="micro">
          {t("space.myShareCaption", {
            part: formatPercentLabel(data.myShare.part * 100, locale),
          })}
        </Text>
      ) : null}

      {comparison ? (
        <PrivateAmount
          className={cn(
            "text-sm",
            comparison.better ? "text-success" : "text-muted-foreground",
          )}
        >
          {comparison.text}
        </PrivateAmount>
      ) : null}

      <SpendBars data={data} />
    </HomeCard>
  );
}

/**
 * Six months of spending, this one lit and the rest in the background: one
 * series, so emphasis rather than colour. Each bar grows from the floor on
 * arrival.
 */
function SpendBars({ data }: { data: HomeMonth }) {
  const locale = useLocale();
  const format = useFormatCurrency();
  const { hidden } = usePrivacy();
  const { trend } = data.spent;
  const peak = Math.max(1, ...trend.map((point) => point.total));
  const shownKey = `${data.year}-${String(data.month).padStart(2, "0")}`;

  const summary = hidden
    ? undefined
    : trend.map((point) => `${point.label} ${format(point.total)}`).join(", ");

  return (
    <View
      accessible
      accessibilityLabel={summary}
      className="h-20 flex-row items-end gap-2"
    >
      {trend.map((point) => (
        <SpendBar
          key={point.monthKey}
          ratio={point.total / peak}
          shown={point.monthKey === shownKey}
          label={monthShort(Number(point.monthKey.slice(5, 7)), locale)}
        />
      ))}
    </View>
  );
}

function SpendBar({
  ratio,
  shown,
  label,
}: {
  ratio: number;
  shown: boolean;
  label: string;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);
  const height = Math.max(0.05, Math.min(1, ratio));

  useEffect(() => {
    progress.value = reduce
      ? 1
      : withDelay(
          GROW_DELAY_MS,
          withTiming(1, { duration: GROW_MS, easing: EASING }),
        );
  }, [reduce, progress]);

  const style = useAnimatedStyle(() => ({
    height: `${height * 100 * progress.value}%`,
  }));

  return (
    <View className="h-full flex-1 items-center justify-end gap-1">
      <View className="w-full max-w-6 flex-1 justify-end">
        <Animated.View
          className="w-full rounded-t-[4px]"
          style={[
            {
              backgroundColor: shown ? colors.primary : colors.foreground,
              opacity: shown ? 1 : 0.15,
            },
            style,
          ]}
        />
      </View>
      <Text
        className={cn(
          "text-[11px] uppercase",
          shown ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </Text>
    </View>
  );
}
