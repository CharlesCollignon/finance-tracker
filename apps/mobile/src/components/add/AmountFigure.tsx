import { useEffect } from "react";
import { Pressable, Text as RNText } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { formatAmountInput } from "@finance/core/amount-input";
import { amountSign } from "@finance/core/amount-sign";
import { DURATION } from "@finance/core/motion";
import type { CategoryType } from "@finance/core/types/database";

import { useLocale, useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

import { KIND_INK, withAlpha } from "./kind-ink";

const FACE = "Fraunces-SemiBold";

interface AmountFigureProps {
  /** The raw entry, "42.5" — see `@finance/core/amount-input`. */
  amount: string;
  kind: CategoryType;
  symbol: string;
  /** Bumped on each key the entry refused, which shakes the figure once. */
  refusals: number;
  /** Bumped on each key it took, which nudges it. */
  presses: number;
  onPress: () => void;
}

/**
 * The amount, as the subject of the sheet: in the serif money is set in, in
 * its kind's colour, with the sign the ledger will show it with.
 *
 * Both motions answer a finger. A key that lands nudges the figure by 3 %
 * and back; one the entry cannot take (a third decimal, a tenth digit)
 * shakes it, where before the key simply did nothing.
 */
export function AmountFigure({
  amount,
  kind,
  symbol,
  refusals,
  presses,
  onPress,
}: AmountFigureProps) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const display = formatAmountInput(amount, locale);
  const ink = colors[KIND_INK[kind]];
  const color = display.empty
    ? withAlpha(ink, 0.45)
    : ink;

  const shift = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (refusals === 0) {
      return;
    }
    const step = DURATION.press / 3;
    shift.set(
      withSequence(
        withTiming(-6, { duration: step }),
        withTiming(6, { duration: step }),
        withTiming(0, { duration: step }),
      ),
    );
  }, [refusals, shift]);

  useEffect(() => {
    if (presses === 0) {
      return;
    }
    scale.set(
      withSequence(
        withTiming(1.03, { duration: DURATION.press / 2 }),
        withTiming(1, { duration: DURATION.press / 2 }),
      ),
    );
  }, [presses, scale]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.get() }, { scale: scale.get() }],
  }));

  const spoken = display.empty
    ? t("entry.amountEmpty")
    : t("entry.amountLabel", {
        amount: `${amountSign(kind)}${display.integer}${display.fraction} ${symbol}`,
      });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      className="items-center px-4 pb-1 pt-5"
    >
      <Animated.View style={motion}>
        <RNText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={{
            fontFamily: FACE,
            fontSize: 60,
            letterSpacing: -2,
            color,
            fontVariant: ["tabular-nums"],
          }}
        >
          <RNText style={{ fontSize: 34 }}>{amountSign(kind)}</RNText>
          {display.integer}
          <RNText style={{ fontSize: 30 }}>{display.fraction}</RNText>
          <RNText style={{ fontSize: 30 }}>{` ${symbol}`}</RNText>
        </RNText>
      </Animated.View>
    </Pressable>
  );
}
