import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View, type GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { monthShort } from "@finance/core/i18n/calendar-names";
import { EASE_STANDARD } from "@finance/core/motion";

import { Text } from "@/components/ui/Text";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import type { ClosedMonthRow } from "@/lib/queries";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { usePlanMoney } from "./format";
import { Glow } from "./Glow";
import { PlanCard, PlanCardHeader } from "./PlanCard";

const PLOT = 120;
const MAX_BARS = 12;
const EASING = Easing.bezier(...EASE_STANDARD);

interface Bar {
  monthKey: string;
  label: string;
  kept: number;
}

/**
 * What each closed month kept, as bars that grow in one after another, the
 * best of them lit. A touch or a drag reads a month out above them.
 *
 * Below, the way into the closes' detail and settings — the reading day and
 * the allowance — which only mean anything next to the months they shape.
 */
export function MonthsCard({
  history,
  detailsOpen,
  onToggleDetails,
}: {
  /** Newest first, as the overview returns it. */
  history: ClosedMonthRow[];
  detailsOpen: boolean;
  onToggleDetails: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const { shown } = usePlanMoney();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const lastTick = useRef<number | null>(null);

  const bars = useMemo<Bar[]>(
    () =>
      history
        .filter((row) => row.kept !== null)
        .slice(0, MAX_BARS)
        .reverse()
        .map((row) => ({
          monthKey: row.monthKey,
          label: row.label,
          kept: row.kept!,
        })),
    [history],
  );

  const best = bars.reduce<number | null>(
    (top, bar, index) =>
      bar.kept > 0 && (top === null || bar.kept > bars[top]!.kept)
        ? index
        : top,
    null,
  );
  const max = Math.max(0, ...bars.map((bar) => bar.kept));
  const min = Math.min(0, ...bars.map((bar) => bar.kept));
  const span = Math.max(1, max - min);
  // Where zero sits, from the top: a month that ended behind hangs below it.
  const zero = (max / span) * PLOT;

  function pick(event: GestureResponderEvent) {
    if (width === 0 || bars.length === 0) {
      return;
    }
    const index = Math.min(
      bars.length - 1,
      Math.max(
        0,
        Math.floor((event.nativeEvent.locationX / width) * bars.length),
      ),
    );
    if (lastTick.current !== index) {
      lastTick.current = index;
      void hapticSelection();
    }
    setActive(index);
  }

  const read =
    active !== null && bars[active]
      ? t("futurePlan.scrubPoint", {
          month: bars[active].label,
          amount: shown(bars[active].kept),
        })
      : best !== null
        ? t("futurePlan.monthsBest", {
            month: bars[best]!.label,
            amount: shown(bars[best]!.kept),
          })
        : null;

  return (
    <PlanCard>
      <PlanCardHeader title={t("futurePlan.monthsTitle")} />

      {bars.length === 0 ? (
        <Text variant="muted" className="text-sm">
          {t("futurePlan.monthsEmpty")}
        </Text>
      ) : (
        <View className="gap-2">
          <Text
            numberOfLines={1}
            className={
              active !== null
                ? "text-sm font-medium tabular-nums"
                : "text-sm text-muted-foreground"
            }
          >
            {read ?? " "}
          </Text>

          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${t("futurePlan.monthsTitle")}. ${read ?? ""}`}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={pick}
            onResponderMove={pick}
            onResponderRelease={() => {
              lastTick.current = null;
            }}
            onResponderTerminate={() => {
              lastTick.current = null;
            }}
            className="flex-row gap-1.5"
            style={{ height: PLOT }}
          >
            {bars.map((bar, index) => (
              <BarColumn
                key={bar.monthKey}
                height={(Math.abs(bar.kept) / span) * PLOT}
                below={bar.kept < 0}
                zero={zero}
                index={index}
                best={index === best}
                active={index === active}
              />
            ))}
            <View
              pointerEvents="none"
              className="absolute left-0 right-0"
              style={{
                top: zero,
                height: 1,
                backgroundColor: colors.hairlineStrong,
              }}
            />
          </View>

          <View className="flex-row gap-1.5">
            {bars.map((bar) => (
              <Text
                key={bar.monthKey}
                variant="micro"
                numberOfLines={1}
                adjustsFontSizeToFit
                className="flex-1 text-center"
              >
                {monthShort(Number(bar.monthKey.slice(5, 7)), locale)}
              </Text>
            ))}
          </View>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsOpen }}
        onPress={() => {
          void hapticLight();
          onToggleDetails();
        }}
        className="-mx-1 min-h-12 flex-row items-center justify-between gap-3 border-t border-border px-1 pt-3"
      >
        <Text className="text-sm font-medium">
          {t(
            detailsOpen
              ? "planPhone.closeDetailsHide"
              : "planPhone.closeDetails",
          )}
        </Text>
        <Ionicons
          name={detailsOpen ? "chevron-up" : "chevron-down"}
          size={ICON.md}
          color={colors.mutedForeground}
        />
      </Pressable>
    </PlanCard>
  );
}

function BarColumn({
  height,
  below,
  zero,
  index,
  best,
  active,
}: {
  height: number;
  below: boolean;
  zero: number;
  index: number;
  best: boolean;
  active: boolean;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const grow = useSharedValue(reduce ? height : 0);

  useEffect(() => {
    grow.value = reduce
      ? height
      : withDelay(
          150 + index * 70,
          withTiming(height, { duration: 600, easing: EASING }),
        );
  }, [height, index, reduce, grow]);

  const style = useAnimatedStyle(() => ({
    height: Math.max(2, grow.value),
    top: below ? zero : zero - Math.max(2, grow.value),
  }));

  return (
    <View pointerEvents="none" className="relative flex-1">
      {best ? (
        <View
          className="absolute left-0 right-0 items-center"
          style={{ top: zero - height, height: 0 }}
        >
          <Glow size={90} />
        </View>
      ) : null}
      <Animated.View
        className="absolute left-0 right-0 rounded-full"
        style={[
          {
            backgroundColor: best
              ? colors.primary
              : active
                ? colors.foreground
                : colors.mutedForeground,
            opacity: best || active ? 1 : 0.45,
          },
          style,
        ]}
      />
    </View>
  );
}
