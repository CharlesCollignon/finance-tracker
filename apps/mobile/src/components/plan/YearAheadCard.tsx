import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { formatMonthCompact } from "@finance/core/constants";
import type { Envelope } from "@finance/core/future-plan";
import type { ForwardProjection } from "@finance/core/projection";
import {
  buildYearAhead,
  YEAR_AHEAD_EVENT_DEFAULTS,
  YEAR_AHEAD_INFLATION,
  YEAR_AHEAD_HORIZONS,
  type YearAheadAccountId,
  type YearAheadEvent,
  type YearAheadEventKind,
  type YearAheadHorizon,
  type YearAheadSettings,
} from "@finance/core/year-ahead";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { monthAheadLabel, usePlanMoney } from "./format";
import { PlanCard } from "./PlanCard";
import { accountColors, accountNameKey, FOLLOW } from "./year-ahead-parts";
import { YearAheadAccounts } from "./YearAheadAccounts";
import { YearAheadChart } from "./YearAheadChart";
import { YearAheadWhatIf } from "./YearAheadWhatIf";
import { YearAheadWhy } from "./YearAheadWhy";

/** When the next milestone comes, with and without the extra. */
export interface MilestoneSooner {
  amount: number;
  /** Months away as things stand, or null when not inside the horizon. */
  without: number | null;
  /** Months away with the extra, or null. */
  with: number | null;
}

interface YearAheadCardProps {
  projection: ForwardProjection;
  /** Whether any recurring entry is running: without one there is no year ahead. */
  hasTemplates: boolean;
  year: number;
  month: number;
  /** The savings accounts and wallets, from the user's own figures. */
  envelopes: readonly Envelope[];
  /** The wallets' market value is still on its way. */
  pending: boolean;
  settings: YearAheadSettings;
  onSettingsChange: (next: YearAheadSettings) => void;
  /** Where « Et si… » goes, already checked against the accounts there are. */
  target: YearAheadAccountId;
  extra: number;
  onExtraChange: (value: number) => void;
  sooner: MilestoneSooner | null;
}

/**
 * The hero: what every account holds at the end of the window, counting up
 * over the bands that get there — the web's « Dans un an », on the phone.
 *
 * The figure is the current account walked forward by the recurring
 * entries, plus each savings account and wallet growing by what goes in and
 * what it earns. The chart stacks them under the gold line of their sum, and
 * the legend under it reads them out — at the end, or at the month under
 * the finger — and takes any of them out with a tap. Under it, one panel
 * at a time: « Pourquoi » cuts a month's income into where it goes;
 * « Et si… » aims an extra at one account and adds the events the recurring
 * entries cannot know, each a marker that rides the line.
 */
export function YearAheadCard(props: YearAheadCardProps) {
  const t = useT();
  const router = useRouter();
  const { projection, hasTemplates } = props;

  if (!hasTemplates || !projection.summary || projection.points.length < 2) {
    return (
      <PlanCard bezel>
        <Text accessibilityRole="header" className="text-sm font-medium">
          {t("futurePlan.yearTitle")}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("planWeb.yearEmpty")}
        </Text>
        <Button
          label={t("planWeb.yearEmptyCta")}
          variant="pill"
          icon="arrow-forward"
          className="self-start"
          onPress={() => router.push("/(tabs)/recurring" as never)}
        />
      </PlanCard>
    );
  }
  return <YearAhead {...props} />;
}

function YearAhead({
  projection,
  year,
  month,
  envelopes,
  pending,
  settings,
  onSettingsChange,
  target,
  extra,
  onExtraChange,
  sooner,
}: YearAheadCardProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { whole, shown } = usePlanMoney();
  const [focus, setFocus] = useState<YearAheadAccountId | null>(null);
  // « Pourquoi » or « Et si… »: one at a time, so the card reads calmly.
  const [panel, setPanel] = useState<"why" | "whatIf">("why");
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  const { points, opening, makeup, summary } = projection;
  const grounded = opening.onHand !== null;

  // Never every account hidden: a card with nothing on it explains nothing.
  const ahead = useMemo(() => {
    const build = (hidden: readonly YearAheadAccountId[]) =>
      buildYearAhead({
        points,
        onHandToday: opening.onHand,
        envelopes,
        horizon: settings.horizon,
        extra: { monthly: extra, to: target },
        events: settings.events,
        hidden,
        complete: !pending,
        inflation: YEAR_AHEAD_INFLATION,
        realTerms: settings.realTerms,
      });
    const built = build(settings.hidden);
    return built.bands.every((band) => band.hidden) ? build([]) : built;
  }, [points, opening.onHand, envelopes, settings, extra, target, pending]);

  // What the extra alone adds, on the same accounts: the web's sum.
  const withoutExtra = useMemo(
    () =>
      extra > 0
        ? buildYearAhead({
            points,
            onHandToday: opening.onHand,
            envelopes,
            horizon: settings.horizon,
            events: settings.events,
            hidden: ahead.bands
              .filter((band) => band.hidden)
              .map((band) => band.id),
            complete: !pending,
            inflation: YEAR_AHEAD_INFLATION,
            realTerms: settings.realTerms,
          })
        : null,
    [points, opening.onHand, envelopes, settings, extra, ahead.bands, pending],
  );

  // A tick each time sliding brings the next milestone closer, so the finger
  // feels the moment it pays off.
  const gained =
    sooner && sooner.with !== null
      ? sooner.without === null
        ? Infinity
        : sooner.without - sooner.with
      : 0;
  const lastGained = useRef(gained);
  useEffect(() => {
    if (gained > lastGained.current) {
      void hapticSelection();
    }
    lastGained.current = gained;
  }, [gained]);

  const months = ahead.months;
  const color = useMemo(() => accountColors(envelopes), [envelopes]);
  const name = (id: YearAheadAccountId) => t(accountNameKey(id));
  const stepLabel = (step: number) =>
    step === 0 ? t("futurePlan.today") : (points[step - 1]?.label ?? "");
  const axisLabel = (step: number) => {
    if (step === 0) {
      return t("futurePlan.today");
    }
    const point = points[step - 1];
    return point ? formatMonthCompact(point.year, point.month, locale) : "";
  };
  // A tick where each year turns, once the window is long enough to need
  // it, and never on top of the labels at either end.
  const yearTicks =
    months >= 24
      ? points.slice(0, months - 1).flatMap((point, index) =>
          point.month === 1 &&
          index + 1 >= months * 0.15 &&
          index + 1 <= months * 0.85
            ? [{ step: index + 1, label: String(point.year) }]
            : [],
        )
      : [];

  const end = ahead.total[months] ?? 0;
  const played = ahead.total.some(
    (value, step) => Math.abs(value - (ahead.baseline[step] ?? 0)) >= 1,
  );
  const someHidden = ahead.bands.some((band) => band.hidden);
  const endLabel = points[months - 1]?.label ?? summary?.endLabel ?? "";
  const title =
    settings.horizon < 12
      ? t("futurePlan.inMonthsTitle", { count: settings.horizon })
      : t("futurePlan.inYearsTitle", { count: settings.horizon / 12 });
  const extraGain = withoutExtra ? end - (withoutExtra.total[months] ?? 0) : 0;

  let soonerLine: string | null = null;
  if (extra > 0 && sooner && sooner.with !== null) {
    if (sooner.without === null) {
      soonerLine = t("futurePlan.whatIfNowReached", {
        milestone: shown(sooner.amount),
        month: monthAheadLabel(year, month, sooner.with, locale),
      });
    } else if (sooner.without > sooner.with) {
      soonerLine = t("futurePlan.whatIfSooner", {
        milestone: shown(sooner.amount),
        count: sooner.without - sooner.with,
      });
    }
  }

  /* ------------------------------------------------ the settings' moves */

  const update = (patch: Partial<YearAheadSettings>) =>
    onSettingsChange({ ...settings, ...patch });

  const toggle = (id: YearAheadAccountId) => {
    void hapticSelection();
    update({
      hidden: settings.hidden.includes(id)
        ? settings.hidden.filter((other) => other !== id)
        : [...settings.hidden, id],
    });
  };

  const addEvent = (kind: YearAheadEventKind) => {
    const event: YearAheadEvent = {
      id: `${kind}-${Date.now().toString(36)}`,
      kind,
      amount: YEAR_AHEAD_EVENT_DEFAULTS[kind],
      month: Math.max(1, Math.ceil(months / 2)),
    };
    // An event lands on the current account, so it has to be on the chart.
    update({
      events: [...settings.events, event],
      hidden: settings.hidden.filter((id) => id !== "current"),
    });
  };

  const changeEvent = (id: string, patch: Partial<YearAheadEvent>) =>
    update({
      events: settings.events.map((event) =>
        event.id === id ? { ...event, ...patch } : event,
      ),
    });

  const targets: YearAheadAccountId[] = [
    ...envelopes.map((envelope) => envelope.id),
    "current",
  ];

  return (
    <PlanCard bezel>
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-sm font-medium">
          {title}
        </Text>
        <AnimatedAmount
          value={end}
          format={whole}
          startFrom={0}
          style={TYPE.hero}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Text variant="muted" className="text-sm">
          {someHidden
            ? t("futurePlan.yearShownOnly", { month: endLabel })
            : grounded
              ? t("futurePlan.yearAllGrounded", { month: endLabel })
              : t("futurePlan.yearAllAdded", { month: endLabel })}
        </Text>
        {ahead.range ? (
          <Text variant="muted" className="text-sm">
            {t("futurePlan.rangeLine", {
              low: shown(ahead.range.low[months] ?? 0),
              high: shown(ahead.range.high[months] ?? 0),
            })}
          </Text>
        ) : null}
        {end - ahead.afterTax.total >= 1 ? (
          <Text variant="muted" className="text-sm">
            {t("futurePlan.afterTaxLine", {
              amount: shown(ahead.afterTax.total),
            })}
          </Text>
        ) : null}
        <TodaysEuros
          on={settings.realTerms}
          onChange={(realTerms) => update({ realTerms })}
        />
      </View>

      {makeup.noIncomeScheduled ? (
        <Pressable
          onPress={() => router.push("/(tabs)/recurring" as never)}
          className="rounded-card border border-destructive/40 bg-destructive/10 p-row"
          accessibilityRole="button"
          accessibilityLabel={t("projection.noIncomeCta")}
        >
          <Text className="text-sm">{t("projection.noIncomeCharge")}</Text>
        </Pressable>
      ) : null}

      <Segmented
        label={t("futurePlan.horizon")}
        options={YEAR_AHEAD_HORIZONS.map((horizon) => ({
          value: horizon,
          label:
            horizon < 12
              ? t("futurePlan.horizonMonths", { count: horizon })
              : t("futurePlan.years", { count: horizon / 12 }),
        }))}
        value={settings.horizon}
        onChange={(horizon: YearAheadHorizon) => update({ horizon })}
      />

      <YearAheadChart
        ahead={ahead}
        showBaseline={played}
        events={settings.events}
        onMoveEvent={(id, next) => changeEvent(id, { month: next })}
        onActiveChange={setActive}
        stepLabel={stepLabel}
        axisLabel={axisLabel}
        yearTicks={yearTicks}
        money={shown}
        label={title}
      />

      <YearAheadAccounts
        bands={ahead.bands}
        step={active ?? months}
        pending={pending}
        played={played}
        focus={focus}
        color={color}
        name={name}
        onToggle={toggle}
        whole={whole}
      />
      <View className="gap-1">
        {!grounded ? (
          <Text variant="muted" className="text-xs">
            {t("futurePlan.currentNoBank")}
          </Text>
        ) : null}
        <Text variant="micro">{t("futurePlan.assumptions")}</Text>
      </View>

      <View className="gap-4 border-t border-border pt-4">
        <Segmented
          label={t("futurePlan.detailsLabel")}
          options={[
            { value: "why" as const, label: t("futurePlan.whyTitle") },
            { value: "whatIf" as const, label: t("futurePlan.whatIfTitle") },
          ]}
          value={panel}
          onChange={(next) => {
            setFocus(null);
            setPanel(next);
          }}
        />
        <Animated.View
          key={panel}
          entering={reduce ? undefined : FadeIn.duration(180)}
        >
          {panel === "why" ? (
            <YearAheadWhy
              flow={ahead.flow}
              everydayCounted={summary?.unrecordedCounted ?? false}
              endLabel={endLabel}
              color={color}
              name={name}
              focus={focus}
              onFocus={setFocus}
              whole={whole}
              shown={shown}
            />
          ) : (
            <YearAheadWhatIf
              extra={extra}
              onExtraChange={onExtraChange}
              targets={targets}
              target={target}
              onTarget={(id) =>
                update({
                  to: id,
                  hidden: settings.hidden.filter((other) => other !== id),
                })
              }
              result={
                extra > 0
                  ? t("futurePlan.whatIfResultBy", {
                      amount: shown(extraGain),
                      month: endLabel,
                    })
                  : null
              }
              soonerLine={soonerLine}
              events={settings.events}
              onAddEvent={addEvent}
              onChangeEvent={changeEvent}
              onRemoveEvent={(id) =>
                update({
                  events: settings.events.filter((event) => event.id !== id),
                })
              }
              onClear={() => {
                onExtraChange(0);
                update({ events: [] });
              }}
              monthLabel={(step) => points[step - 1]?.label ?? ""}
              months={months}
              maxMonth={points.length}
              color={color}
              name={name}
              whole={whole}
            />
          )}
        </Animated.View>
      </View>
    </PlanCard>
  );
}

/* ------------------------------------------------------------ the pieces */

/**
 * A row of equal choices with a pill that springs to the one picked: the
 * window, and « Pourquoi » against « Et si… ».
 */
function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segment = width / options.length;
  const x = useSharedValue(index * segment);

  useEffect(() => {
    x.set(reduce ? index * segment : withSpring(index * segment, FOLLOW));
  }, [index, segment, reduce, x]);

  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 4)}
      className="flex-row rounded-full border border-border p-0.5"
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 2,
              bottom: 2,
              left: 2,
              width: segment,
              borderRadius: 999,
              backgroundColor: colors.muted,
            },
            pill,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (!on) {
                void hapticSelection();
                onChange(option.value);
              }
            }}
            className="min-h-10 flex-1 items-center justify-center rounded-full"
          >
            <Text
              className={cn(
                "text-xs font-medium tabular-nums",
                on ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * « En euros d'aujourd'hui »: off, the euros the accounts will show; on,
 * what each would buy today, prices having risen 2 % a year. The web's
 * switch, with a knob that springs.
 */
function TodaysEuros({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const x = useSharedValue(on ? 12 : 0);
  useEffect(() => {
    x.set(reduce ? (on ? 12 : 0) : withSpring(on ? 12 : 0, FOLLOW));
  }, [on, reduce, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={() => {
        void hapticSelection();
        onChange(!on);
      }}
      className="mt-2 min-h-11 flex-row items-center gap-2 self-start"
    >
      <View
        style={{
          width: 30,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 2,
          justifyContent: "center",
          backgroundColor: on ? colors.foreground : `${colors.foreground}33`,
        }}
      >
        <Animated.View
          style={[
            {
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: colors.background,
            },
            knob,
          ]}
        />
      </View>
      <Text
        className={cn(
          "text-xs font-medium",
          on ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {t("futurePlan.realTerms")}
      </Text>
    </Pressable>
  );
}
