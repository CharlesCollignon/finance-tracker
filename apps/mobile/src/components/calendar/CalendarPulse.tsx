import { useEffect, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { formatCalendarDate, type PulseDay } from "@finance/core/calendar";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { TYPE } from "@/theme/tokens";

/** Each bar starts this long after the one before it, left to right. */
const STEP_MS = 14;
/** The income dots arrive once the bars are well on their way. */
const DOT_DELAY_MS = 300;
const DOT_MS = 400;
const GROW = Easing.bezier(...EASE_STANDARD);

/**
 * The month above its calendar, flat: its net and what came in and went
 * out, then the month itself as a strip — one bar a day, as tall as what
 * left the account, a dot where money came in, the days ahead in outline
 * for what is still planned. The web's `CalendarPulse`, for a finger.
 *
 * Read with the grid below, not apart from it: a finger sliding along the
 * strip lights its day in the grid and says what the day held, and lifting
 * it picks that day. The grid, which offers every day too, stays the way in
 * for screen readers, so the strip keeps out of their path.
 *
 * Colours are the grid's own — what left in the expense red, what came in
 * in the income green — so the two read as one. Each bar grows from the
 * baseline on arrival, left to right, and the net counts up to its value.
 */
export function CalendarPulse({
  label,
  days,
  totals,
  selectedDate,
  focusDate,
  onFocus,
  onSelect,
}: {
  /** The month, « octobre 2026 ». */
  label: string;
  days: readonly PulseDay[];
  totals: { income: number; outflow: number; net: number };
  selectedDate: string;
  /** The day under the finger, lit in the grid as well. */
  focusDate: string | null;
  onFocus: (date: string | null) => void;
  onSelect: (date: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);

  const scale = Math.max(
    1,
    ...days.map((day) => Math.max(day.outflow, day.plannedOutflow)),
  );
  const focus = focusDate
    ? (days.find((day) => day.date === focusDate) ?? null)
    : null;
  const stillToCome = days.reduce((sum, day) => sum + day.plannedOutflow, 0);

  const summary = [
    t("calendarView.inAndOut", {
      income: format(totals.income),
      outflow: format(totals.outflow),
    }),
    stillToCome > 0
      ? t("calendarView.pulseStillToCome", { amount: format(stillToCome) })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // The bars are out of touch's way, so the position is the strip's own.
  function dayAt(event: GestureResponderEvent): PulseDay | null {
    if (width === 0 || days.length === 0) {
      return null;
    }
    const index = Math.floor(
      (event.nativeEvent.locationX / width) * days.length,
    );
    return days[Math.min(days.length - 1, Math.max(0, index))] ?? null;
  }

  function follow(event: GestureResponderEvent) {
    const day = dayAt(event);
    if (day && day.date !== focusDate) {
      void hapticSelection();
      onFocus(day.date);
    }
  }

  return (
    <View className="gap-5 border-b border-border pb-6">
      <View className="flex-row items-end justify-between gap-4">
        <View className="min-w-0 flex-1">
          <Text className="font-semibold capitalize" style={{ fontSize: 17 }}>
            {label}
          </Text>
          <PrivateAmount
            accessibilityLiveRegion="polite"
            numberOfLines={2}
            className="mt-1 text-sm text-muted-foreground"
          >
            {focus ? dayLine(focus) : summary}
          </PrivateAmount>
        </View>
        <AnimatedAmount
          value={totals.net}
          startFrom={0}
          format={(value) =>
            `${value >= 0 ? "+" : "−"}${format(Math.abs(value))}`
          }
          className={totals.net < 0 ? "text-destructive" : "text-success"}
          style={TYPE.figure}
          numberOfLines={1}
        />
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="h-16"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={follow}
        onResponderMove={follow}
        onResponderRelease={(event) => {
          const day = dayAt(event);
          onFocus(null);
          if (day) {
            void hapticLight();
            onSelect(day.date);
          }
        }}
        onResponderTerminate={() => onFocus(null)}
      >
        <View pointerEvents="none" className="h-full flex-row items-end gap-[3px]">
          {days.map((day, index) => (
            <PulseBar
              key={day.date}
              day={day}
              index={index}
              scale={scale}
              lit={day.date === selectedDate || day.date === focusDate}
              reduce={reduce}
            />
          ))}
        </View>
      </View>
    </View>
  );

  function dayLine(day: PulseDay): string {
    const parts = [
      day.outflow > 0
        ? t("calendarView.pulseOut", { amount: format(day.outflow) })
        : null,
      day.income > 0
        ? t("calendarView.pulseIn", { amount: format(day.income) })
        : null,
      day.outflow === 0 && day.plannedOutflow > 0
        ? t("calendarView.pulsePlannedOut", {
            amount: format(day.plannedOutflow),
          })
        : null,
      day.income === 0 && day.plannedIncome > 0
        ? t("calendarView.pulsePlannedIn", {
            amount: format(day.plannedIncome),
          })
        : null,
    ].filter(Boolean);
    return `${formatCalendarDate(day.date, locale)} · ${
      parts.length > 0 ? parts.join(" · ") : t("calendarView.pulseNothing")
    }`;
  }
}

/**
 * One day of the strip: its bar grown from the baseline, its income dot,
 * and today's mark under it. Colours sit on plain views inside the animated
 * ones, which carry only the motion.
 */
function PulseBar({
  day,
  index,
  scale,
  lit,
  reduce,
}: {
  day: PulseDay;
  index: number;
  scale: number;
  lit: boolean;
  reduce: boolean;
}) {
  const grow = useSharedValue(reduce ? 1 : 0);
  const pop = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      grow.set(1);
      pop.set(1);
      return;
    }
    grow.set(
      withDelay(
        index * STEP_MS,
        withTiming(1, { duration: DURATION.count, easing: GROW }),
      ),
    );
    pop.set(
      withDelay(
        DOT_DELAY_MS + index * STEP_MS,
        withTiming(1, { duration: DOT_MS, easing: Easing.out(Easing.ease) }),
      ),
    );
  }, [reduce, index, grow, pop]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: grow.get() }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: pop.get(),
    transform: [{ scale: 0.6 + 0.4 * pop.get() }],
  }));

  const planned = day.outflow === 0 ? day.plannedOutflow : 0;
  const value = day.outflow || planned;
  const hasIncome = day.income > 0 || day.plannedIncome > 0;

  return (
    <View className="h-full min-w-0 flex-1 items-center justify-end">
      {hasIncome ? (
        <Animated.View style={[{ marginBottom: 4 }, dotStyle]}>
          <View
            className={cn(
              "size-1.5 rounded-full",
              day.income > 0 ? "bg-success" : "border border-success/70",
            )}
            style={lit ? { transform: [{ scale: 1.5 }] } : undefined}
          />
        </Animated.View>
      ) : null}
      <Animated.View
        style={[
          {
            width: "100%",
            transformOrigin: "bottom",
            height:
              value > 0 ? `${Math.max(8, (value / scale) * 80)}%` : 2,
          },
          barStyle,
        ]}
      >
        <View
          className={cn(
            "flex-1",
            value === 0
              ? cn("rounded-[1px]", lit ? "bg-foreground/50" : "bg-foreground/10")
              : day.outflow > 0
                ? cn("rounded-t-[3px]", lit ? "bg-destructive" : "bg-destructive/40")
                : cn(
                    "rounded-t-[3px] border border-dashed",
                    lit ? "border-foreground/70" : "border-muted-foreground/45",
                  ),
          )}
        />
      </Animated.View>
      {day.isToday ? (
        <View className="absolute -bottom-2.5 size-1 rounded-full bg-foreground" />
      ) : null}
    </View>
  );
}
