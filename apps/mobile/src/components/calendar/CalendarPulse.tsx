import { useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Animated, {
  useReducedMotion,
} from "react-native-reanimated";

import { formatCalendarDate, type PulseDay } from "@finance/core/calendar";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { TYPE } from "@/theme/tokens";
import { FADE_IN } from "@/components/motion/fade";


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
 * in the income green — so the two read as one. The strip fades in, and
 * the net counts up to its value.
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
        <Animated.View
          pointerEvents="none"
          entering={reduce ? undefined : FADE_IN}
          className="h-full flex-row items-end gap-[3px]"
        >
          {days.map((day) => (
            <PulseBar
              key={day.date}
              day={day}
              scale={scale}
              lit={day.date === selectedDate || day.date === focusDate}
            />
          ))}
        </Animated.View>
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
 * One day of the strip: its bar, its income dot, and today's mark under it.
 * The strip fades in as one.
 */
function PulseBar({
  day,
  scale,
  lit,
}: {
  day: PulseDay;
  scale: number;
  lit: boolean;
}) {
  const planned = day.outflow === 0 ? day.plannedOutflow : 0;
  const value = day.outflow || planned;
  const hasIncome = day.income > 0 || day.plannedIncome > 0;

  return (
    <View className="h-full min-w-0 flex-1 items-center justify-end">
      {hasIncome ? (
        <View style={{ marginBottom: 4 }}>
          <View
            className={cn(
              "size-1.5 rounded-full",
              day.income > 0 ? "bg-success" : "border border-success/70",
            )}
            style={lit ? { transform: [{ scale: 1.5 }] } : undefined}
          />
        </View>
      ) : null}
      <View
        style={{
          width: "100%",
          height: value > 0 ? `${Math.max(8, (value / scale) * 80)}%` : 2,
        }}
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
      </View>
      {day.isToday ? (
        <View className="absolute -bottom-2.5 size-1 rounded-full bg-foreground" />
      ) : null}
    </View>
  );
}
