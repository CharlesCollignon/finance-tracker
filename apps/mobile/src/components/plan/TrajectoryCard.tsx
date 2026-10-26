import { useState, type ReactNode } from "react";
import { View } from "react-native";

import {
  TRAJECTORY_YEARS,
  type TrajectoryYears,
} from "@finance/core/history/plan-accounts";
import {
  historyMonthLabel,
  taxAtHorizon,
} from "@finance/core/history/plan-figures";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { ToggleRow } from "@/components/property/fields";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { TYPE } from "@/theme/tokens";

import { usePlanMoney } from "./format";
import { PlanCard, PlanCardHeader } from "./PlanCard";
import { TrajectoryChart } from "./TrajectoryChart";
import type { PlanReplay } from "./use-plan-replay";

/**
 * « Votre trajectoire »: the accounts replayed on every start since 1970,
 * as the web draws it, and under the chart, in the same card, the accounts
 * it is made of.
 *
 * One figure — the middle start, in today's euros, counting to its new
 * value when the horizon or an account's figure moves — then the band eight
 * starts in ten end in, the value after tax and the worst start, named. A
 * finger along the chart reads a month out. The accounts come last, as
 * `children`, so the eye goes from the line to what makes it.
 */
export function TrajectoryCard({
  replay,
  years,
  onYears,
  hasProperty,
  withProperty,
  onWithProperty,
  children,
}: {
  replay: PlanReplay;
  years: TrajectoryYears;
  onYears: (years: TrajectoryYears) => void;
  hasProperty: boolean;
  withProperty: boolean;
  onWithProperty: (on: boolean) => void;
  /** « Vos comptes », under the chart. */
  children: ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const { whole, shown } = usePlanMoney();
  const [active, setActive] = useState<number | null>(null);

  const { result } = replay;
  const property = replay.property;
  const plus = (values: readonly number[], offset: number) =>
    values.map((value, index) => value + (property?.[index + offset] ?? 0));
  const low = [replay.today, ...plus(result.band.p10, 1)];
  const middle = [replay.today, ...plus(result.band.p50, 1)];
  const high = [replay.today, ...plus(result.band.p90, 1)];
  const homes = property?.at(-1) ?? 0;

  // What selling everything at the horizon would leave.
  const afterTax =
    result.end.p50 +
    homes -
    taxAtHorizon({
      result,
      accounts: replay.accounts,
      envelopes: replay.envelopes,
    });

  const scrubWhen = (index: number) =>
    index % 12 === 0
      ? t("trajectory.scrubYears", { count: index / 12 })
      : t("trajectory.scrubMonths", { count: index });
  const endLine = t("trajectory.scrubPoint", {
    when: scrubWhen(middle.length - 1),
    median: shown(middle.at(-1) ?? 0),
    low: shown(low.at(-1) ?? 0),
    high: shown(high.at(-1) ?? 0),
  });

  return (
    <PlanCard bezel>
      <PlanCardHeader title={t("trajectory.title")} />
      <SegmentedControl
        label={t("trajectory.horizonLabel")}
        segments={TRAJECTORY_YEARS.map((each) => ({
          value: String(each),
          label: t("futurePlan.years", { count: each }),
        }))}
        value={String(years)}
        onChange={(value) => {
          setActive(null);
          onYears(Number(value) as TrajectoryYears);
        }}
      />

      <View className="gap-1">
        <Text variant="muted" className="text-sm">
          {t("futurePlan.inYearsTitle", { count: years })}
        </Text>
        <AnimatedAmount
          value={Math.round(result.end.p50 + homes)}
          format={whole}
          style={TYPE.hero}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Text variant="muted" className="text-xs">
          {t("trajectory.medianCaption")}
        </Text>
      </View>

      <View className="min-h-16 gap-0.5" accessibilityLiveRegion="polite">
        {active !== null ? (
          <Text className="text-sm font-medium tabular-nums">
            {t("trajectory.scrubPoint", {
              when: scrubWhen(active),
              median: shown(middle[active] ?? 0),
              low: shown(low[active] ?? 0),
              high: shown(high[active] ?? 0),
            })}
          </Text>
        ) : (
          <>
            <Text className="text-sm tabular-nums">
              {t("trajectory.rangeLine", {
                low: shown(result.end.p10 + homes),
                high: shown(result.end.p90 + homes),
              })}
            </Text>
            <Text variant="muted" className="text-sm tabular-nums">
              {t("trajectory.afterTax", { amount: shown(afterTax) })}
            </Text>
            <Text variant="muted" className="text-sm tabular-nums">
              {t("trajectory.worstLine", {
                month: historyMonthLabel(result.worst.start, locale),
                amount: shown(result.worst.value + homes),
              })}
            </Text>
          </>
        )}
      </View>

      <View className="gap-1">
        <TrajectoryChart
          key={`${years}-${withProperty}`}
          low={low}
          middle={middle}
          high={high}
          active={active}
          onActive={setActive}
          label={`${t("trajectory.chartLabel")}. ${endLine}`}
          format={shown}
        />
        <Text variant="micro">{t("planPhone.scrubMonths")}</Text>
      </View>

      {hasProperty ? (
        <ToggleRow
          label={t("trajectory.withProperty")}
          hint={t("trajectory.withPropertyHint")}
          value={withProperty}
          onChange={onWithProperty}
        />
      ) : null}

      {children}
    </PlanCard>
  );
}
