import { useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatOccurrenceDates } from "@finance/core/apply-recurring";
import { shiftIsoDate, todayIsoLocal } from "@finance/core/constants";
import {
  ENTRY_RHYTHMS,
  offersAdvance,
  type EntryRhythm,
} from "@finance/core/entry-draft";
import {
  monthLong,
  monthShort,
  weekdayShortMondayFirst,
} from "@finance/core/i18n/calendar-names";
import type { CategoryType } from "@finance/core/types/database";

import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { hapticSelection } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { Chip, DayCells, Segmented } from "./choices";
import { KIND_INK } from "./kind-ink";

export interface WhenState {
  recurring: boolean;
  /** For an entry that happened once. */
  occurredOn: string;
  rhythm: EntryRhythm;
  dayOfMonth: number;
  dayOfWeek: number;
  month: number;
  amountVaries: boolean;
  withAdvance: boolean;
  advanceDay: number;
  advanceAmount: string;
  startThisMonth: boolean;
  startsOn: string;
  endsOn: string;
}

const RHYTHM_KEY = {
  monthly: "entry.rhythm.monthly",
  weekly: "entry.rhythm.weekly",
  quarterly: "entry.rhythm.quarterly",
  yearly: "entry.rhythm.yearly",
} as const;

interface WhenPanelProps {
  kind: CategoryType;
  value: WhenState;
  onChange: (patch: Partial<WhenState>) => void;
  /** The days this schedule has already passed this month, today included. */
  pastThisMonth: string[];
}

/**
 * « Quand », which is where an entry becomes recurring: once, on a day
 * picked from the month, or regularly, on a rhythm and a day. What used to
 * be a separate form behind « Récurrente » is the second answer to this one
 * question, and the rarer settings (the dates it runs between) wait behind
 * « Plus d'options ».
 */
export function WhenPanel({
  kind,
  value,
  onChange,
  pastThisMonth,
}: WhenPanelProps) {
  const t = useT();
  const colors = useThemeColors();
  const ink = colors[KIND_INK[kind]];
  const [showMore, setShowMore] = useState(
    value.startsOn !== "" || value.endsOn !== "",
  );

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 12 }}
    >
      <Segmented
        label={t("entry.when")}
        value={value.recurring ? "repeats" : "once"}
        onChange={(answer) => onChange({ recurring: answer === "repeats" })}
        options={[
          { value: "once", label: t("entry.once") },
          { value: "repeats", label: t("entry.repeats") },
        ]}
      />

      {value.recurring ? (
        <Recurring
          kind={kind}
          value={value}
          onChange={onChange}
          ink={ink}
          pastThisMonth={pastThisMonth}
          showMore={showMore}
          onToggleMore={() => setShowMore((open) => !open)}
        />
      ) : (
        <Once value={value.occurredOn} onChange={onChange} ink={ink} />
      )}
    </ScrollView>
  );
}


function Recurring({
  kind: entryKind,
  value: state,
  onChange: change,
  ink: color,
  pastThisMonth: past,
  showMore: more,
  onToggleMore,
}: {
  kind: CategoryType;
  value: WhenState;
  onChange: (patch: Partial<WhenState>) => void;
  ink: string;
  pastThisMonth: string[];
  showMore: boolean;
  onToggleMore: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const weekdays = weekdayShortMondayFirst(locale);
  const days = Array.from({ length: 31 }, (_, i) => ({ day: i + 1 }));
  const advance = offersAdvance(entryKind, state.rhythm);

  return (
    <View className="mt-4 gap-4">
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t("recurring.rhythm")}
        className="flex-row flex-wrap gap-2"
      >
        {ENTRY_RHYTHMS.map((rhythm) => (
          <Chip
            key={rhythm}
            label={t(RHYTHM_KEY[rhythm])}
            selected={state.rhythm === rhythm}
            ink={color}
            onPress={() => change({ rhythm })}
          />
        ))}
      </View>

      {state.rhythm === "weekly" ? (
        <Section title={t("entry.whichDay")}>
          <View className="flex-row gap-1">
            {weekdays.map((name, index) => (
              <Chip
                key={name}
                label={name}
                selected={state.dayOfWeek === index + 1}
                ink={color}
                onPress={() => change({ dayOfWeek: index + 1 })}
                className="flex-1 px-0"
              />
            ))}
          </View>
        </Section>
      ) : (
        <>
          {state.rhythm === "yearly" || state.rhythm === "quarterly" ? (
            <Section
              title={
                state.rhythm === "yearly"
                  ? t("entry.whichMonth")
                  : t("entry.startsMonth")
              }
            >
              <View className="flex-row flex-wrap gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <Chip
                    key={month}
                    label={monthShort(month, locale)}
                    selected={state.month === month}
                    ink={color}
                    onPress={() => change({ month })}
                    className="px-3"
                  />
                ))}
              </View>
            </Section>
          ) : null}
          <Section title={t("entry.dayOfMonth")}>
            <DayCells
              label={t("entry.dayOfMonth")}
              cells={days}
              selected={state.dayOfMonth}
              ink={color}
              onPick={(dayOfMonth) => change({ dayOfMonth })}
            />
          </Section>
        </>
      )}

      <View>
        <ToggleRow
          title={t("recurring.amountVaries")}
          hint={t("recurring.amountVariesHint")}
          value={state.amountVaries}
          onChange={(amountVaries) => change({ amountVaries })}
          ink={color}
        />

        {advance ? (
          <ToggleRow
            title={t("recurring.advance")}
            hint={t("recurring.advanceHint")}
            value={state.withAdvance}
            onChange={(withAdvance) => change({ withAdvance })}
            ink={color}
          >
            {state.withAdvance ? (
              <View className="mt-3 gap-3">
                <Input
                  value={state.advanceAmount}
                  onChangeText={(advanceAmount) => change({ advanceAmount })}
                  keyboardType="decimal-pad"
                  placeholder={t("recurring.advanceAmount")}
                  accessibilityLabel={t("recurring.advanceAmount")}
                  className="rounded-2xl bg-foreground/5"
                />
                <Stepper
                  label={t("recurring.advanceDay")}
                  value={state.advanceDay}
                  onChange={(advanceDay) => change({ advanceDay })}
                />
              </View>
            ) : null}
          </ToggleRow>
        ) : null}

        {past.length > 0 ? (
          <ToggleRow
            title={t("recurring.startThisMonth")}
            hint={t("recurring.startThisMonthHint", {
              count: past.length,
              dates: formatOccurrenceDates(past, locale),
            })}
            value={state.startThisMonth}
            onChange={(startThisMonth) => change({ startThisMonth })}
            ink={color}
          />
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        onPress={onToggleMore}
        className="min-h-10 flex-row items-center gap-1.5 self-start"
      >
        <Text className="text-[13px] font-medium">
          {more ? t("entry.fewerOptions") : t("entry.moreOptions")}
        </Text>
        <Ionicons
          name={more ? "chevron-up" : "chevron-down"}
          size={ICON.sm}
          color={colors.foreground}
        />
      </Pressable>

      {more ? (
        <View className="gap-3">
          <Text variant="muted" className="text-xs">
            {t("recurring.activePeriodNote")}
          </Text>
          <DateField
            value={state.startsOn}
            onChange={(startsOn) => change({ startsOn })}
            placeholder={t("recurring.noStartDate")}
            accessibilityLabel={t("recurring.startsOn")}
            clearable
          />
          <DateField
            value={state.endsOn}
            onChange={(endsOn) => change({ endsOn })}
            placeholder={t("recurring.noEndDate")}
            accessibilityLabel={t("recurring.endsOn")}
            clearable
          />
        </View>
      ) : null}
    </View>
  );
}

function Once({
  value: occurredOn,
  onChange: change,
  ink: color,
}: {
  value: string;
  onChange: (patch: Partial<WhenState>) => void;
  ink: string;
}) {
  const t = useT();
  const today = todayIsoLocal();
  const quick = [
    { date: today, label: t("calendar.today") },
    { date: shiftIsoDate(today, -1), label: t("calendar.yesterday") },
    { date: shiftIsoDate(today, -2), label: t("entry.dayBefore") },
  ];
  return (
    <View className="mt-4 gap-4">
      <View className="flex-row flex-wrap gap-2">
        {quick.map((option) => (
          <Chip
            key={option.date}
            label={option.label}
            selected={occurredOn === option.date}
            ink={color}
            onPress={() => change({ occurredOn: option.date })}
          />
        ))}
      </View>
      <MonthGrid
        value={occurredOn}
        today={today}
        ink={color}
        onPick={(date) => change({ occurredOn: date })}
      />
    </View>
  );
}

function MonthGrid({
  value: picked,
  today,
  ink: color,
  onPick,
}: {
  value: string;
  today: string;
  ink: string;
  onPick: (date: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const [shown, setShown] = useState(() => {
    const [year, month] = picked.split("-").map(Number);
    return { year: year!, month: month! };
  });
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const isCurrent = shown.year === todayYear && shown.month === todayMonth;
  const length = new Date(shown.year, shown.month, 0).getDate();
  const lead = (new Date(shown.year, shown.month - 1, 1).getDay() + 6) % 7;
  const iso = (day: number) =>
    `${shown.year}-${String(shown.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, i) => ({
      day: i + 1,
      disabled: iso(i + 1) > today,
    })),
  ];
  const [pickedYear, pickedMonth, pickedDay] = picked.split("-").map(Number);
  const step = (by: number) => {
    void hapticSelection();
    setShown(({ year, month }) => {
      const next = new Date(year, month - 1 + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  };

  return (
    <View>
      <View className="mb-1 flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.previousMonth")}
          onPress={() => step(-1)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={ICON.lg} color={colors.foreground} />
        </Pressable>
        <Text className="text-sm font-semibold">
          {`${monthLong(shown.month, locale)} ${shown.year}`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.nextMonth")}
          accessibilityState={{ disabled: isCurrent }}
          disabled={isCurrent}
          onPress={() => step(1)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center"
          style={{ opacity: isCurrent ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-forward" size={ICON.lg} color={colors.foreground} />
        </Pressable>
      </View>
      <View className="mb-1 flex-row">
        {weekdayShortMondayFirst(locale).map((name) => (
          <Text
            key={name}
            variant="muted"
            className="flex-1 text-center text-[11px]"
          >
            {name}
          </Text>
        ))}
      </View>
      <DayCells
        label={t("quickAdd.date")}
        cells={cells}
        ink={color}
        selected={
          pickedYear === shown.year && pickedMonth === shown.month
            ? pickedDay!
            : null
        }
        marked={isCurrent ? todayDay : null}
        onPick={(day) => onPick(iso(day))}
      />
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold text-muted-foreground">
        {title}
      </Text>
      {children}
    </View>
  );
}

function ToggleRow({
  title,
  hint,
  value,
  onChange,
  ink,
  children,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  ink: string;
  children?: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View className="border-t border-border py-3">
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="font-medium">{title}</Text>
          <Text variant="muted" className="mt-0.5 text-xs">
            {hint}
          </Text>
        </View>
        <Switch
          accessibilityLabel={title}
          value={value}
          onValueChange={(next) => {
            void hapticSelection();
            onChange(next);
          }}
          trackColor={{ false: colors.secondary, true: ink }}
          thumbColor={value ? colors.background : colors.foreground}
        />
      </View>
      {children}
    </View>
  );
}

/** A day of the month nudged one at a time: the advance's payday. */
function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const colors = useThemeColors();
  const set = (next: number) => {
    void hapticSelection();
    onChange(Math.min(31, Math.max(1, next)));
  };
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm">{label}</Text>
      <View className="flex-row items-center gap-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} −1`}
          onPress={() => set(value - 1)}
          className="h-10 w-10 items-center justify-center rounded-full border border-border"
        >
          <Ionicons name="remove" size={ICON.md} color={colors.foreground} />
        </Pressable>
        <Text
          accessibilityLabel={`${label} ${value}`}
          className="w-10 text-center font-semibold tabular-nums"
        >
          {value}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} +1`}
          onPress={() => set(value + 1)}
          className="h-10 w-10 items-center justify-center rounded-full border border-border"
        >
          <Ionicons name="add" size={ICON.md} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}
