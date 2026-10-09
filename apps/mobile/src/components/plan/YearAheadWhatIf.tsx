import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useReducedMotion,
  ZoomIn,
} from "react-native-reanimated";

import {
  YEAR_AHEAD_EVENT_KINDS,
  YEAR_AHEAD_MAX_EVENTS,
  type YearAheadAccountId,
  type YearAheadEvent,
  type YearAheadEventKind,
} from "@finance/core/year-ahead";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { ExtraSlider } from "./ExtraSlider";
import { NumberField } from "./Fields";
import {
  EVENT_ICONS,
  EVENT_NAME_KEYS,
  eventTone,
} from "./year-ahead-parts";

const EXTRA_MAX = 500;
const EXTRA_STEP = 25;
const EXTRA_CHIPS = [50, 100, 200] as const;
/** The most an event can be: well past a car, short of a flat. */
const EVENT_MAX = 100_000;

/**
 * « Et si… » on the phone, as on the web: the slider puts so much more
 * aside each month into the account picked under it, and the events are
 * what the recurring entries cannot know — each a marker on the curve, its
 * small card here to type the amount and step the month, added from one
 * button that opens to the three kinds.
 */
export function YearAheadWhatIf({
  extra,
  onExtraChange,
  targets,
  target,
  onTarget,
  result,
  soonerLine,
  events,
  onAddEvent,
  onChangeEvent,
  onRemoveEvent,
  onClear,
  monthLabel,
  months,
  maxMonth,
  color,
  name,
  whole,
}: {
  extra: number;
  onExtraChange: (extra: number) => void;
  targets: readonly YearAheadAccountId[];
  target: YearAheadAccountId;
  onTarget: (id: YearAheadAccountId) => void;
  /** What the extra adds by the end of the window, in a sentence. */
  result: string | null;
  /** What it does to the next milestone, if anything. */
  soonerLine: string | null;
  events: readonly YearAheadEvent[];
  onAddEvent: (kind: YearAheadEventKind) => void;
  onChangeEvent: (id: string, patch: Partial<YearAheadEvent>) => void;
  onRemoveEvent: (id: string) => void;
  onClear: () => void;
  /** "mars 2027" for a month ahead, 1 being this one. */
  monthLabel: (month: number) => string;
  /** The window's length: an event after it waits. */
  months: number;
  /** The last month an event can be moved to. */
  maxMonth: number;
  color: (id: YearAheadAccountId) => string;
  name: (id: YearAheadAccountId) => string;
  whole: (value: number) => string;
}) {
  const t = useT();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const full = events.length >= YEAR_AHEAD_MAX_EVENTS;
  const [adding, setAdding] = useState(false);

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="muted" className="min-w-0 flex-1 text-sm">
          {t("futurePlan.whatIfLabel")}
        </Text>
        <Text
          className={cn(
            "font-semibold tabular-nums",
            extra > 0 ? "text-primary" : "text-muted-foreground",
          )}
          style={{ fontSize: 17 }}
        >
          {t("futurePlan.whatIfPerMonth", { amount: whole(extra) })}
        </Text>
      </View>

      <ExtraSlider
        value={extra}
        max={EXTRA_MAX}
        step={EXTRA_STEP}
        onChange={onExtraChange}
        label={t("futurePlan.whatIfLabel")}
        valueText={t("futurePlan.whatIfPerMonth", { amount: whole(extra) })}
      />

      <View className="flex-row gap-2">
        {EXTRA_CHIPS.map((amount) => {
          const selected = extra === amount;
          return (
            <Pressable
              key={amount}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t("futurePlan.whatIfPerMonth", {
                amount: whole(amount),
              })}
              onPress={() => {
                void hapticSelection();
                onExtraChange(selected ? 0 : amount);
              }}
              className={cn(
                "min-h-12 flex-1 items-center justify-center rounded-full border",
                selected ? "border-foreground bg-foreground" : "border-border",
              )}
            >
              <Text
                className={cn(
                  "text-sm font-medium tabular-nums",
                  selected ? "text-background" : "text-foreground",
                )}
              >
                {t("planPhone.chipExtra", { amount: whole(amount) })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t("futurePlan.whatIfToLabel")}
        className="flex-row flex-wrap items-center gap-2"
      >
        <Text variant="muted" className="text-sm">
          {t("futurePlan.whatIfTo")}
        </Text>
        {targets.map((id) => {
          const on = id === target;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                void hapticSelection();
                onTarget(id);
              }}
              className={cn(
                "min-h-11 flex-row items-center gap-2 rounded-full border px-3.5",
                on ? "border-foreground/40 bg-muted" : "border-border",
              )}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: color(id),
                }}
              />
              <Text
                className={cn(
                  "text-sm",
                  on ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {name(id)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View accessibilityLiveRegion="polite" className="min-h-12 gap-1">
        {result ? (
          <Text className="text-base font-medium">{result}</Text>
        ) : (
          <Text variant="muted" className="text-sm">
            {t("futurePlan.whatIfNone")}
          </Text>
        )}
        {result && soonerLine ? (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="sparkles" size={ICON.sm} color={colors.primary} />
            <Text className="shrink text-sm font-medium text-primary">
              {soonerLine}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="gap-3 border-t border-border pt-4">
        {events.map((event) => (
          <Animated.View
            key={event.id}
            entering={reduce ? undefined : FadeInDown.springify().damping(18)}
            exiting={reduce ? undefined : FadeOut.duration(200)}
            layout={reduce ? undefined : LinearTransition.springify().damping(20)}
          >
            <EventCard
              event={event}
              monthLabel={monthLabel}
              months={months}
              maxMonth={maxMonth}
              onChange={(patch) => onChangeEvent(event.id, patch)}
              onRemove={() => onRemoveEvent(event.id)}
            />
          </Animated.View>
        ))}
        {events.length > 0 ? (
          <Text variant="muted" className="text-xs">
            {t("futurePlan.eventsHint")}
          </Text>
        ) : null}

        <View className="flex-row flex-wrap items-center gap-2">
          {adding ? (
            YEAR_AHEAD_EVENT_KINDS.map((kind, index) => (
              <Animated.View
                key={kind}
                entering={
                  reduce ? undefined : ZoomIn.delay(index * 40).springify().damping(16)
                }
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void hapticSelection();
                    onAddEvent(kind);
                    setAdding(false);
                  }}
                  className="min-h-11 flex-row items-center gap-1.5 rounded-full border border-border px-3.5"
                >
                  <Ionicons
                    name={EVENT_ICONS[kind]}
                    size={ICON.sm}
                    color={eventTone(kind)}
                  />
                  <Text className="text-sm">{t(EVENT_NAME_KEYS[kind])}</Text>
                </Pressable>
              </Animated.View>
            ))
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={full}
              onPress={() => {
                void hapticSelection();
                setAdding(true);
              }}
              className="min-h-11 flex-row items-center gap-1.5 rounded-full border border-dashed border-border px-3.5"
              style={{ opacity: full ? 0.5 : 1 }}
            >
              <Ionicons name="add" size={ICON.sm} color={colors.mutedForeground} />
              <Text variant="muted" className="text-sm">
                {t("futurePlan.eventAdd")}
              </Text>
            </Pressable>
          )}
          {extra > 0 || events.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void hapticSelection();
                onClear();
              }}
              className="ml-auto min-h-11 justify-center px-2"
            >
              <Text variant="muted" className="text-sm">
                {t("futurePlan.whatIfClear")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** One event: its name and a cross, the amount to type, the month to step. */
function EventCard({
  event,
  monthLabel,
  months,
  maxMonth,
  onChange,
  onRemove,
}: {
  event: YearAheadEvent;
  monthLabel: (month: number) => string;
  months: number;
  maxMonth: number;
  onChange: (patch: Partial<YearAheadEvent>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const tone = eventTone(event.kind);
  const eventName = t(EVENT_NAME_KEYS[event.kind]);
  const step = (delta: number) => {
    void hapticSelection();
    onChange({
      month: Math.min(maxMonth, Math.max(1, event.month + delta)),
    });
  };
  const when =
    event.month > months
      ? `${monthLabel(event.month)} · ${t("futurePlan.eventBeyond")}`
      : monthLabel(event.month);

  return (
    <View className="gap-2 rounded-card border border-border bg-muted/30 p-3">
      <View className="flex-row items-center gap-2">
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.muted,
          }}
        >
          <Ionicons name={EVENT_ICONS[event.kind]} size={ICON.sm} color={tone} />
        </View>
        <Text className="min-w-0 flex-1 text-sm font-medium">{eventName}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("futurePlan.eventRemove", { name: eventName })}
          onPress={() => {
            void hapticSelection();
            onRemove();
          }}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <Ionicons name="close" size={ICON.md} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View className="flex-row items-end gap-2">
        <NumberField
          label={
            event.kind === "raise"
              ? t("futurePlan.eventRaiseAmount")
              : t("futurePlan.eventAmount")
          }
          value={event.amount}
          kind="money"
          min={0}
          max={EVENT_MAX}
          onChange={(amount) => onChange({ amount })}
        />

        <View className="min-w-0 flex-[1.4] gap-1">
          <Text variant="muted" numberOfLines={1} className="text-xs">
            {t("futurePlan.eventMonth")}
          </Text>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t("futurePlan.eventMonth")}
            accessibilityValue={{ text: when }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(action) =>
              step(action.nativeEvent.actionName === "increment" ? 1 : -1)
            }
            className="min-h-12 flex-row items-center rounded-control border border-border bg-background"
          >
            <Pressable
              accessibilityElementsHidden
              importantForAccessibility="no"
              disabled={event.month <= 1}
              onPress={() => step(-1)}
              className="h-12 w-10 items-center justify-center"
              style={{ opacity: event.month <= 1 ? 0.35 : 1 }}
            >
              <Ionicons name="chevron-back" size={ICON.md} color={colors.foreground} />
            </Pressable>
            <Text
              numberOfLines={1}
              className={cn(
                "flex-1 text-center text-sm tabular-nums",
                event.month > months && "text-muted-foreground",
              )}
            >
              {when}
            </Text>
            <Pressable
              accessibilityElementsHidden
              importantForAccessibility="no"
              disabled={event.month >= maxMonth}
              onPress={() => step(1)}
              className="h-12 w-10 items-center justify-center"
              style={{ opacity: event.month >= maxMonth ? 0.35 : 1 }}
            >
              <Ionicons name="chevron-forward" size={ICON.md} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
