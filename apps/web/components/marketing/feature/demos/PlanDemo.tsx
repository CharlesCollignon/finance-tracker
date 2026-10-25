"use client";

import { useMemo, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import {
  TRAJECTORY_YEARS,
  type TrajectoryYears,
} from "@finance/core/history/plan-accounts";
import {
  historyMonthLabel,
  trajectoryAccountKey,
} from "@finance/core/history/plan-figures";
import { EASE_STANDARD } from "@finance/core/motion";
import {
  niceTicks,
  resampleSeries,
  type YearAheadAccountId,
} from "@finance/core/year-ahead";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import {
  SAMPLE_TARGETS,
  sampleTrajectory,
} from "@/components/marketing/plan-sample";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { Chip, Count, Range } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["plan"];

/** Every line drawn from this many points, so one horizon morphs into the next. */
const SAMPLES = 61;
const HEIGHT = 220;
const MORPH = {
  duration: 0.55,
  ease: [...EASE_STANDARD] as [number, number, number, number],
};
/** The sample's year: the horizon lands this many years after it. */
const SAMPLE_YEAR = 2026;

/**
 * « Votre trajectoire », played with the landing's sample person: the
 * horizon from one year to thirty, so much more set aside each month into
 * the account picked, and the card answering as it moves — the middle start
 * counting to its new value, the gold line and the band eight starts in ten
 * end in morphing on their labelled scale, the worst start named, each
 * account's value counting to its new end. The same replay as the app's
 * Plan (`@finance/core/history`: every start since 1970, in today's euros),
 * on the same sample as the mock above it.
 */
export function PlanDemo({ copy }: { copy: Copy }) {
  const t = useT();
  const locale = useLocale();
  const euro = useFormatCurrency();
  const money = (value: number) => euro(Math.round(value));
  const still = useReducedMotion() ?? false;
  const [years, setYears] = useState<TrajectoryYears>(10);
  const [extra, setExtra] = useState(100);
  const [to, setTo] = useState<YearAheadAccountId>("pea");

  const without = useMemo(() => sampleTrajectory(years), [years]);
  const played = useMemo(
    () =>
      extra > 0 ? sampleTrajectory(years, { monthly: extra, to }) : without,
    [years, extra, to, without],
  );
  const { result, today } = played;
  const gain = result.end.p50 - without.result.end.p50;
  const name = (id: string) => t(trajectoryAccountKey(id));

  const shape = useMemo(() => {
    const total = resampleSeries([today, ...result.band.p50], SAMPLES);
    const baseline = resampleSeries(
      [without.today, ...without.result.band.p50],
      SAMPLES,
    );
    const low = resampleSeries([today, ...result.band.p10], SAMPLES);
    const high = resampleSeries([today, ...result.band.p90], SAMPLES);
    const values = [...total, ...baseline, ...low, ...high];
    const pad = (Math.max(...values) - Math.min(...values)) * 0.05 || 1;
    const min = Math.min(...values) - pad;
    const max = Math.max(...values) + pad;
    const x = (index: number) => (index / (SAMPLES - 1)) * 1000;
    const y = (value: number) =>
      6 + ((max - value) / (max - min)) * (HEIGHT - 12);
    const line = (series: readonly number[]) =>
      series
        .map(
          (value, index) =>
            `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`,
        )
        .join(" ");
    const back = low
      .map((value, index) => `L${x(index).toFixed(1)},${y(value).toFixed(1)}`)
      .reverse()
      .join(" ");
    return {
      ticks: niceTicks(min, max).map((tick) => ({ tick, top: y(tick) })),
      band: `${line(high)} ${back} Z`,
      total: line(total),
      baseline: line(baseline),
      endY: y(result.end.p50),
    };
  }, [today, result, without]);
  const morph = still ? { duration: 0 } : MORPH;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center">
      <div className="flex flex-col gap-6">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t("trajectory.horizonLabel")}
        >
          {TRAJECTORY_YEARS.map((each) => (
            <Chip
              key={each}
              active={each === years}
              onClick={() => setYears(each)}
            >
              {t("futurePlan.years", { count: each })}
            </Chip>
          ))}
        </div>
        <Range
          label={t("futurePlan.whatIfLabel")}
          value={extra}
          min={0}
          max={500}
          step={25}
          onChange={setExtra}
          display={t("futurePlan.whatIfPerMonth", { amount: euro(extra) })}
        />
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t("futurePlan.whatIfToLabel")}
        >
          <span className="text-sm text-marketing-muted">
            {t("futurePlan.whatIfTo")}
          </span>
          {SAMPLE_TARGETS.map((id) => (
            <Chip key={id} active={id === to} onClick={() => setTo(id)}>
              {name(id)}
            </Chip>
          ))}
        </div>
        <p className="min-h-6 text-sm text-marketing-muted" aria-live="polite">
          {extra > 0
            ? t("trajectory.whatIfResult", {
                amount: money(gain),
                year: String(SAMPLE_YEAR + years),
              })
            : t("futurePlan.whatIfNone")}
        </p>
        <p className="text-xs text-marketing-faint">{copy.note}</p>
      </div>

      {/* First on a phone, so the band moves in sight of the finger on the
          slider under it. */}
      <div className="order-first md:order-none">
        <p className="text-lg text-marketing-muted">
          {t("futurePlan.inYearsTitle", { count: years })}
        </p>
        <p className="mt-1 font-serif text-[clamp(2.75rem,7vw,4.75rem)] font-semibold leading-none tracking-[-0.035em] text-primary-ink">
          <Count value={result.end.p50} format={money} />
        </p>
        <p className="mt-2 text-sm text-marketing-muted">
          {t("trajectory.medianCaption")}
        </p>
        <p className="text-sm text-marketing-muted">
          {t("trajectory.rangeLine", {
            low: money(result.end.p10),
            high: money(result.end.p90),
          })}
        </p>
        <p className="text-sm text-marketing-muted">
          {t("trajectory.worstLine", {
            month: historyMonthLabel(result.worst.start, locale),
            amount: money(result.worst.value),
          })}
        </p>

        <div className="relative mt-8 w-full" style={{ height: HEIGHT }}>
          {shape.ticks.map(({ tick, top }) => (
            <m.div
              key={tick}
              aria-hidden
              className="absolute inset-x-0 border-t border-white/10"
              initial={false}
              animate={{ top }}
              transition={morph}
            >
              <span className="absolute -top-4 left-0 text-xs tabular-nums text-marketing-faint">
                {money(tick)}
              </span>
            </m.div>
          ))}
          <svg
            viewBox={`0 0 1000 ${HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            aria-hidden
          >
            <m.path
              initial={false}
              animate={{ d: shape.band }}
              transition={morph}
              fill="var(--primary)"
              fillOpacity={0.16}
            />
            <m.path
              initial={false}
              animate={{ d: shape.baseline, opacity: extra > 0 ? 0.7 : 0 }}
              transition={morph}
              fill="none"
              stroke="white"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              vectorEffect="non-scaling-stroke"
            />
            <m.path
              initial={false}
              animate={{ d: shape.total }}
              transition={morph}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2.25}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <m.span
            aria-hidden
            className="absolute right-0 size-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary"
            initial={false}
            animate={{ top: shape.endY }}
            transition={morph}
          />
        </div>

        <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {result.accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate text-marketing-muted">
                {name(account.id)}
              </span>
              <Count
                value={account.median}
                format={money}
                className="font-mono text-marketing-ink"
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
