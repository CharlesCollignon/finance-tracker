import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { formatPercentLabel } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import type { LoanPayment } from "@finance/core/loan-schedule";
import { EASE_STANDARD } from "@finance/core/motion";
import {
  PROGRESS_MARKS,
  type LoanProgress,
  type Ownership,
} from "@finance/core/property-progress";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

import { monthAndYear } from "./fields";

/**
 * A property's progress, drawn: how much of it is the user's, how far a
 * loan has come, and what the next payment makes theirs — the web's
 * `ProgressBars`, natively.
 *
 * Neutral bars, as the Plan's milestones ahead are: gold means done, so
 * only a mark already passed takes it. Each bar grows from nothing as it
 * arrives, and reduced motion shows it at its length.
 */

const EASING = Easing.bezier(...EASE_STANDARD);

function percent(value: number, locale: Locale): string {
  return formatPercentLabel(Math.round(value * 1000) / 10, locale);
}

/** A bar's fill, growing to `fraction` of its track. */
function Fill({
  fraction,
  opacity,
  height,
}: {
  fraction: number;
  opacity: number;
  height: number;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const grown = useSharedValue(reduce ? fraction : 0);

  useEffect(() => {
    grown.value = reduce
      ? fraction
      : withDelay(150, withTiming(fraction, { duration: 800, easing: EASING }));
  }, [fraction, reduce, grown]);

  const style = useAnimatedStyle(() => ({ width: `${grown.value * 100}%` }));
  return (
    <Animated.View
      style={[
        { height, borderRadius: height, backgroundColor: colors.foreground, opacity },
        style,
      ]}
    />
  );
}

/** « À vous / à la banque »: the user's part of a home that is theirs. */
export function OwnershipBar({
  ownership,
  detailed = false,
}: {
  ownership: Ownership;
  /** With the amounts under it, on the property's own screen. */
  detailed?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const all = ownership.owed <= 0;
  const under = !all && ownership.yours <= 0;
  const yours = all
    ? t("property.ownershipAll")
    : t("property.ownershipYours", { share: percent(ownership.share, locale) });
  const bank = under
    ? t("property.ownershipUnder")
    : t("property.ownershipBank", { share: percent(1 - ownership.share, locale) });

  return (
    <View className="gap-1.5">
      <View
        accessible
        accessibilityLabel={all ? yours : `${yours} · ${bank}`}
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: colors.muted }}
      >
        <Fill fraction={ownership.share} opacity={0.75} height={8} />
        {PROGRESS_MARKS.map((mark) => (
          <View
            key={mark}
            className="absolute bottom-0 top-0 w-px"
            style={{ left: `${mark * 100}%`, backgroundColor: colors.background, opacity: 0.6 }}
          />
        ))}
      </View>
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
        <Text className="text-xs font-medium">{yours}</Text>
        {all ? null : (
          <Text variant="muted" className="text-xs">
            {bank}
          </Text>
        )}
      </View>
      {detailed && !all ? (
        <PrivateAmount className="text-xs text-muted-foreground">
          {t("property.ownershipAmounts", {
            yours: format(ownership.yours),
            owed: format(ownership.owed),
          })}
        </PrivateAmount>
      ) : null}
    </View>
  );
}

/** A loan's track: what is repaid, its marks, and what is left. */
export function LoanTrack({ progress, inFine }: { progress: LoanProgress; inFine: boolean }) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const end = progress.endsOn ? monthAndYear(progress.endsOn, locale) : null;
  const repaid = t("property.loanRepaidShare", { share: percent(progress.repaid, locale) });

  if (inFine) {
    return end && progress.paymentsLeft > 0 ? (
      <Text variant="muted" className="text-xs">
        {t("property.loanInFineTrack", { date: end })}
      </Text>
    ) : null;
  }

  return (
    <View className="gap-1.5">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
        <Text className="text-xs font-medium">{repaid}</Text>
        {end && progress.paymentsLeft > 0 ? (
          <Text variant="muted" className="text-xs">
            {t("property.loanLeft", { count: progress.paymentsLeft, date: end })}
          </Text>
        ) : null}
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={repaid}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.repaid * 100) }}
        className="h-1.5 justify-center rounded-full"
        style={{ backgroundColor: colors.muted }}
      >
        <Fill fraction={progress.repaid} opacity={0.6} height={6} />
        {/* The marks: gold once passed, because passed means done. */}
        {PROGRESS_MARKS.map((mark) => (
          <View
            key={mark}
            className="absolute h-2.5 w-2.5 rounded-full"
            style={{
              left: `${mark * 100}%`,
              marginLeft: -5,
              borderWidth: 2,
              borderColor: colors.card,
              backgroundColor: progress.passed.includes(mark) ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * The next payment, as one bar: the principal it repays — what becomes the
 * user's — then its interest and insurance.
 */
export function PaymentBar({
  split,
}: {
  split: Pick<LoanPayment, "principal" | "interest" | "insurance">;
}) {
  const t = useT();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const principal = Math.max(0, split.principal);
  const total = principal + split.interest + split.insurance;
  if (total <= 0) {
    return null;
  }
  const part = (value: number) => `${(value / total) * 100}%` as const;
  const segment = (value: number, opacity: number) => (
    <View
      className="h-1.5 rounded-full"
      style={{ width: part(value), backgroundColor: colors.foreground, opacity }}
    />
  );

  return (
    <View className="gap-1.5">
      <View className="h-1.5 flex-row gap-0.5 overflow-hidden rounded-full">
        {segment(principal, 0.7)}
        {segment(split.interest, 0.3)}
        {split.insurance > 0 ? segment(split.insurance, 0.15) : null}
      </View>
      <PrivateAmount className="text-xs text-muted-foreground">
        {[
          t("property.paymentYours", { amount: format(principal) }),
          t("property.paymentInterest", { amount: format(split.interest) }),
          split.insurance > 0
            ? t("property.paymentInsurance", { amount: format(split.insurance) })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </PrivateAmount>
    </View>
  );
}
