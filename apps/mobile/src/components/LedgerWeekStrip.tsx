import { Fragment, useEffect, useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import type { LedgerWeek } from "@finance/core/ledger-view";
import { DURATION, EASE_STANDARD, STAGGER_STEP_MS } from "@finance/core/motion";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { RADIUS, TABULAR } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** `OwnerSwitch`'s thumb spring, so the two pills on the phone move alike. */
const PILL_SPRING = { damping: 20, stiffness: 320, mass: 0.7 };
const EASING = Easing.bezier(...EASE_STANDARD);

/** The bars' full height: a busy day reaches it, the rest scale under it. */
const BARS_HEIGHT = 24;
/** A day with one row still has to show as more than the empty stub. */
const MIN_BAR = 3;

interface Bar {
  recorded: number;
  planned: number;
  /** Today's bar carries a dot under it, so the strip says where "now" is. */
  today?: boolean;
}

interface LedgerWeekStripProps {
  weeks: LedgerWeek[];
  /** The week the list shows, by its first day; null for the whole month. */
  value: string | null;
  onChange: (from: string | null) => void;
  className?: string;
}

/**
 * The month above the Journal, a week at a time — the web's
 * `components/finance/LedgerWeekStrip.tsx`, drawn by the phone.
 *
 * A bar for every day, as tall as the rows the list shows on it, cut into
 * Monday-to-Sunday weeks; the first segment is the whole month, its bars one
 * per week. Pressing a week narrows the list to it and pressing it again
 * goes back. A finger dragged sideways along the strip picks whichever week
 * it is over, with a tick for each — vertical drags still scroll the list.
 *
 * The bars count rows rather than money, so the privacy blur has nothing to
 * hide, and are drawn from the rows the other filters keep: a search lights
 * up the days it found something on.
 */
export function LedgerWeekStrip({
  weeks,
  value,
  onChange,
  className,
}: LedgerWeekStripProps) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const today = todayIsoLocal();
  // Where each segment sits in the row, for the pill and for the scrub.
  const [slots, setSlots] = useState<{ x: number; width: number }[]>([]);
  // The segment a scrub last landed on, so a finger resting on one week
  // ticks once rather than on every frame it moves within it; -1 between
  // scrubs. A shared value rather than a ref, which the compiler's lint
  // reads as touched during render when the gesture is built.
  const scrubbed = useSharedValue(-1);

  const options: (string | null)[] = [null, ...weeks.map((week) => week.from)];
  const chosen = Math.max(0, options.indexOf(value));

  const slot = slots[chosen];
  const x = useDerivedValue(() => withSpring(slot?.x ?? 0, PILL_SPRING));
  const width = useDerivedValue(() =>
    withSpring(slot?.width ?? 0, PILL_SPRING),
  );
  const pill = useAnimatedStyle(() => ({
    width: width.get(),
    transform: [{ translateX: x.get() }],
  }));

  const dayMax = Math.max(
    1,
    ...weeks.flatMap((week) =>
      week.days.map((day) => (day ? day.recorded + day.planned : 0)),
    ),
  );
  const weekMax = Math.max(
    1,
    ...weeks.map((week) => week.recorded + week.planned),
  );

  function choose(index: number) {
    const next = options[index] ?? null;
    if (next !== value) {
      void hapticSelection();
      onChange(next);
    }
  }

  function measure(index: number) {
    return (event: LayoutChangeEvent) => {
      const { x: left, width: size } = event.nativeEvent.layout;
      setSlots((current) => {
        const next = [...current];
        next[index] = { x: left, width: size };
        return next;
      });
    };
  }

  const scrub = Gesture.Pan()
    .runOnJS(true)
    // Sideways is the scrub; a few points up or down first and the list
    // scrolls instead.
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      const index = slots.findIndex(
        (each) => each && event.x >= each.x && event.x <= each.x + each.width,
      );
      if (index !== -1 && index !== scrubbed.get()) {
        scrubbed.set(index);
        choose(index);
      }
    })
    .onFinalize(() => {
      scrubbed.set(-1);
    });

  return (
    <GestureDetector gesture={scrub}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t("ledger.weeks")}
        className={cn("flex-row items-stretch gap-0.5", className)}
      >
        {slot ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                borderRadius: RADIUS.control,
                borderWidth: 1,
                borderColor: colors.hairlineStrong,
                backgroundColor: colors.muted,
              },
              pill,
            ]}
          />
        ) : null}
        {options.map((from, index) => {
          const week = index === 0 ? null : weeks[index - 1]!;
          const selected = index === chosen;
          const bars: (Bar | null)[] = week
            ? week.days.map((day) =>
                day
                  ? {
                      recorded: day.recorded,
                      planned: day.planned,
                      today: day.date === today,
                    }
                  : null,
              )
            : weeks.map((each) => ({
                recorded: each.recorded,
                planned: each.planned,
              }));
          // Lit means "on screen": every bar while the month is shown, and
          // only the chosen week's once one is.
          const lit = (barIndex: number) =>
            value === null || (week ? selected : barIndex === chosen - 1);

          return (
            <Fragment key={from ?? "month"}>
              {index === 1 ? (
                <View className="my-2 w-px bg-border" />
              ) : null}
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={
                  week
                    ? week.from === week.to
                      ? formatShortDate(week.from, locale)
                      : t("ledger.weekLabel", {
                          from: formatShortDate(week.from, locale),
                          to: formatShortDate(week.to, locale),
                        })
                    : t("ledger.wholeMonthLabel")
                }
                onLayout={measure(index)}
                onPress={() =>
                  // The chosen week again: back to the month.
                  choose(index === chosen && index !== 0 ? 0 : index)
                }
                className="min-h-11 min-w-0 flex-1 items-center justify-end gap-1.5 px-0.5 pb-1.5 pt-2"
              >
                <Bars
                  bars={bars}
                  max={week ? dayMax : weekMax}
                  lit={lit}
                  delay={index * STAGGER_STEP_MS}
                  reduce={reduce}
                />
                <Text
                  variant="micro"
                  numberOfLines={1}
                  style={TABULAR}
                  className={cn(
                    selected
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {week
                    ? week.from === week.to
                      ? String(Number(week.from.slice(8)))
                      : `${Number(week.from.slice(8))}–${Number(week.to.slice(8))}`
                    : t("ledger.wholeMonth")}
                </Text>
              </Pressable>
            </Fragment>
          );
        })}
      </View>
    </GestureDetector>
  );
}

/**
 * A segment's bars, grown up from the baseline when the strip first draws.
 * Planned rows sit on top of the recorded ones, fainter, the way the list
 * draws them muted; a day with nothing on it keeps a stub, so the week still
 * reads as seven days.
 */
function Bars({
  bars,
  max,
  lit,
  delay,
  reduce,
}: {
  bars: (Bar | null)[];
  max: number;
  lit: (index: number) => boolean;
  delay: number;
  reduce: boolean;
}) {
  const grow = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) {
      grow.set(
        withDelay(
          delay,
          withTiming(1, { duration: DURATION.enter, easing: EASING }),
        ),
      );
    }
  }, [delay, grow, reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: grow.get(),
    transform: [{ scaleY: grow.get() }],
  }));

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        {
          height: BARS_HEIGHT,
          width: "100%",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 2,
          transformOrigin: "bottom",
        },
        style,
      ]}
    >
      {bars.map((bar, index) => (
        <View
          key={index}
          style={{ flex: 1, maxWidth: 6, height: "100%", justifyContent: "flex-end" }}
        >
          {bar ? <DayBar bar={bar} max={max} on={lit(index)} /> : null}
        </View>
      ))}
    </Animated.View>
  );
}

/** One bar, easing to its new height whenever a filter changes it. */
function DayBar({ bar, max, on }: { bar: Bar; max: number; on: boolean }) {
  const colors = useThemeColors();
  const total = bar.recorded + bar.planned;
  const target =
    total === 0 ? 2 : Math.max(MIN_BAR, (total / max) * BARS_HEIGHT);
  const height = useDerivedValue(() =>
    withTiming(target, { duration: DURATION.enter, easing: EASING }),
  );
  const style = useAnimatedStyle(() => ({ height: height.get() }));

  return (
    <View>
      <Animated.View
        style={[
          { width: "100%", borderRadius: RADIUS.pill, overflow: "hidden" },
          style,
        ]}
      >
        {total === 0 ? (
          <View
            style={{
              flex: 1,
              backgroundColor: colors.mutedForeground,
              opacity: on ? 0.4 : 0.2,
            }}
          />
        ) : (
          <>
            {bar.planned > 0 ? (
              <View
                style={{
                  flex: bar.planned,
                  backgroundColor: on ? colors.foreground : colors.mutedForeground,
                  opacity: on ? 0.3 : 0.15,
                }}
              />
            ) : null}
            {bar.recorded > 0 ? (
              <View
                style={{
                  flex: bar.recorded,
                  backgroundColor: on ? colors.foreground : colors.mutedForeground,
                  opacity: on ? 0.85 : 0.35,
                }}
              />
            ) : null}
          </>
        )}
      </Animated.View>
      {bar.today ? (
        <View
          style={{
            position: "absolute",
            bottom: -5,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 3,
              height: 3,
              borderRadius: RADIUS.pill,
              backgroundColor: colors.foreground,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
