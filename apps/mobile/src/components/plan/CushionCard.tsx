import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { CUSHION_TARGETS, type Cushion } from "@finance/core/future-plan";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import type { Translate } from "@finance/core/i18n/t";
import { EASE_STANDARD } from "@finance/core/motion";

import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { PlanCard, PlanCardHeader } from "./PlanCard";

const EASING = Easing.bezier(...EASE_STANDARD);
const LAST = CUSHION_TARGETS[CUSHION_TARGETS.length - 1]!;

/**
 * "4,2 mois", or "3 mois" when whole. Floored to a tenth, because a cushion
 * that covers 2.96 months does not cover three.
 */
export function cushionMonthsText(
  months: number,
  t: Translate,
  locale: Locale,
): string {
  const tenths = Math.floor(months * 10) / 10;
  return Number.isInteger(tenths)
    ? t("futurePlan.cushionMonths", { count: tenths })
    : t("units.months", {
        value: new Intl.NumberFormat(INTL_LOCALES[locale], {
          maximumFractionDigits: 1,
        }).format(tenths),
      });
}

/**
 * How many months of fixed costs the savings would cover, as a gauge with
 * the usual rungs — one, three, six months — lighting up as each is passed.
 */
export function CushionCard({ cushion }: { cushion: Cushion }) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const [why, setWhy] = useState(false);
  const fill = useSharedValue(reduce ? cushion.ratio : 0);

  useEffect(() => {
    fill.value = reduce
      ? cushion.ratio
      : withDelay(
          250,
          withTiming(cushion.ratio, { duration: 900, easing: EASING }),
        );
  }, [cushion.ratio, reduce, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const months = cushion.months;

  return (
    <PlanCard>
      <PlanCardHeader
        title={t("futurePlan.cushionTitle")}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("planPhone.cushionWhy")}
            accessibilityState={{ expanded: why }}
            onPress={() => {
              void hapticLight();
              setWhy((open) => !open);
            }}
            className="-mr-2 -mt-2 h-12 w-12 items-center justify-center"
          >
            <Ionicons
              name={why ? "information-circle" : "information-circle-outline"}
              size={ICON.xl}
              color={colors.mutedForeground}
            />
          </Pressable>
        }
      />

      {why ? (
        <Text variant="muted" className="-mt-2 text-sm">
          {t("futurePlan.cushionWhy")}
        </Text>
      ) : null}

      {months === null ? (
        <Text variant="muted" className="text-sm">
          {t("futurePlan.cushionNoFixed")}
        </Text>
      ) : (
        <>
          <Text className="text-sm">
            {t("futurePlan.cushionBody", {
              months: cushionMonthsText(months, t, locale),
            })}
          </Text>

          <View className="gap-2 pt-1">
            <View className="relative h-7 justify-center">
              <View
                className="h-2.5 overflow-hidden rounded-full"
                style={{ backgroundColor: colors.muted }}
              >
                <Animated.View
                  className="h-2.5 rounded-full"
                  style={[{ backgroundColor: colors.primary }, fillStyle]}
                />
              </View>
              {CUSHION_TARGETS.map((target, index) => {
                const lit = index < cushion.level;
                return (
                  <View
                    key={target}
                    className="absolute h-7 w-7 items-center justify-center rounded-full border-2"
                    style={{
                      left: `${(target / LAST) * 100}%`,
                      marginLeft:
                        index === CUSHION_TARGETS.length - 1 ? -28 : -14,
                      backgroundColor: lit ? colors.primary : colors.card,
                      borderColor: lit ? colors.primary : colors.hairlineStrong,
                    }}
                  >
                    {lit ? (
                      <Ionicons
                        name="checkmark"
                        size={ICON.sm}
                        color={colors.primaryForeground}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
            <View className="relative h-4">
              {CUSHION_TARGETS.map((target, index) => (
                <Text
                  key={target}
                  variant="micro"
                  className="absolute"
                  style={{
                    left: `${(target / LAST) * 100}%`,
                    width: 56,
                    marginLeft:
                      index === CUSHION_TARGETS.length - 1 ? -56 : -28,
                    textAlign:
                      index === CUSHION_TARGETS.length - 1 ? "right" : "center",
                  }}
                >
                  {t("futurePlan.cushionMonths", { count: target })}
                </Text>
              ))}
            </View>
          </View>

          <Text
            className={
              cushion.nextTarget === null
                ? "text-sm font-medium text-primary"
                : "text-sm text-muted-foreground"
            }
          >
            {cushion.nextTarget === null
              ? t("futurePlan.cushionFull")
              : t("futurePlan.cushionNext", {
                  months: t("futurePlan.cushionMonths", {
                    count: cushion.nextTarget,
                  }),
                })}
          </Text>
        </>
      )}
    </PlanCard>
  );
}
