"use client";

import { useState, type ReactNode } from "react";
import { ChartLineUp } from "@phosphor-icons/react";
import {
  TRAJECTORY_YEARS,
  type TrajectoryYears,
} from "@finance/core/history/plan-accounts";
import {
  historyMonthLabel,
  taxAtHorizon,
} from "@finance/core/history/plan-figures";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { PlanCard } from "./plan-controls";
import { TrajectoryChart } from "./TrajectoryChart";
import type { PlanReplay } from "./use-plan-replay";

/**
 * « Votre trajectoire »: the accounts replayed on every start since 1970,
 * and under the chart, in the same card, the accounts it is made of.
 *
 * One figure — the middle start, in today's euros, counting to its new
 * value when the horizon or an account's figure moves — then the band eight
 * starts in ten end in, the value after tax and the worst start, named. The
 * chart under it reads a month out to the pointer. The accounts come last,
 * as `children`, so the eye goes from the line to what makes it.
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
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));
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

  return (
    <PlanCard
      icon={<ChartLineUp size={ICON.sm} weight="bold" />}
      title={t("trajectory.title")}
      aside={
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
          className="text-xs"
        />
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {t("futurePlan.inYearsTitle", { count: years })}
        </p>
        <AnimatedAmount
          value={Math.round(result.end.p50 + homes)}
          format={money}
          className="font-head text-4xl tabular-nums sm:text-5xl"
        />
        <p className="text-xs text-muted-foreground">
          {t("trajectory.medianCaption")}
        </p>
      </div>

      <div className="privacy-sensitive flex min-h-10 flex-col gap-0.5 text-sm">
        {active !== null ? (
          <p className="font-medium tabular-nums">
            {t("trajectory.scrubPoint", {
              when: scrubWhen(active),
              median: money(middle[active]!),
              low: money(low[active]!),
              high: money(high[active]!),
            })}
          </p>
        ) : (
          <>
            <p className="tabular-nums">
              {t("trajectory.rangeLine", {
                low: money(result.end.p10 + homes),
                high: money(result.end.p90 + homes),
              })}
            </p>
            <p className="text-muted-foreground tabular-nums">
              {t("trajectory.afterTax", { amount: money(afterTax) })}
            </p>
            <p className="text-muted-foreground tabular-nums">
              {t("trajectory.worstLine", {
                month: historyMonthLabel(result.worst.start, locale),
                amount: money(result.worst.value + homes),
              })}
            </p>
          </>
        )}
      </div>

      <TrajectoryChart
        key={`${years}-${withProperty}`}
        low={low}
        middle={middle}
        high={high}
        active={active}
        onActive={setActive}
        label={t("trajectory.chartLabel")}
        format={money}
      />

      {hasProperty ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {t("trajectory.withProperty")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("trajectory.withPropertyHint")}
            </p>
          </div>
          <Switch
            checked={withProperty}
            onChange={onWithProperty}
            label={t("trajectory.withProperty")}
          />
        </div>
      ) : null}

      {children}
    </PlanCard>
  );
}
