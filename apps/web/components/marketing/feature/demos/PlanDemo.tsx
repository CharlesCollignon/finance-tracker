"use client";

import { useMemo, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import {
  resampleSeries,
  stackBands,
  YEAR_AHEAD_HORIZONS,
  type YearAheadAccountId,
  type YearAheadHorizon,
} from "@finance/core/year-ahead";
import { EASE_STANDARD } from "@finance/core/motion";
import {
  accountColors,
  accountNameKey,
} from "@/components/finance/plan/year-ahead-parts";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import {
  SAMPLE_ENVELOPES,
  sampleYearAhead,
} from "@/components/marketing/year-ahead-sample";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { Chip, Count, Range } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["plan"];

/** Where the extra can go: the sample's Livret A, its PEA, or the account. */
const TARGETS: YearAheadAccountId[] = ["livret_a", "pea", "current"];

/** Every band drawn from this many points, so one window morphs into the next. */
const SAMPLES = 61;
const HEIGHT = 220;
const MORPH = {
  duration: 0.55,
  ease: [...EASE_STANDARD] as [number, number, number, number],
};

const color = accountColors(SAMPLE_ENVELOPES);

/**
 * « Dans un an », played with the landing's sample person: the window from
 * six months to five years, so much more set aside each month into the
 * account picked, and the card answering as it moves — the figure counting
 * over every account, the bands morphing under the gold total, each
 * account's value springing to its new end. The same rule as the app's
 * Plan (`buildYearAhead`), on the same sample as the mock above it.
 */
export function PlanDemo({ copy }: { copy: Copy }) {
  const t = useT();
  const locale = useLocale();
  const euro = useFormatCurrency();
  const money = (value: number) => euro(Math.round(value));
  const still = useReducedMotion() ?? false;
  const [horizon, setHorizon] = useState<YearAheadHorizon>(12);
  const [extra, setExtra] = useState(100);
  const [to, setTo] = useState<YearAheadAccountId>("pea");

  const { ahead, points } = useMemo(
    () =>
      sampleYearAhead(
        locale,
        horizon,
        extra > 0 ? { monthly: extra, to } : undefined,
      ),
    [locale, horizon, extra, to],
  );
  const without = useMemo(
    () => sampleYearAhead(locale, horizon).ahead,
    [locale, horizon],
  );

  const months = ahead.months;
  const end = ahead.total[months] ?? 0;
  const endLabel = points[months - 1]?.label ?? "";
  const gain = end - (without.total[months] ?? 0);
  const name = (id: YearAheadAccountId) => t(accountNameKey(id));

  const shape = useMemo(() => {
    const stacked = stackBands(
      ahead.bands.map((band) => resampleSeries(band.values, SAMPLES)),
    );
    const total = resampleSeries(ahead.total, SAMPLES);
    const top =
      Math.max(...total, ...resampleSeries(without.total, SAMPLES)) * 1.06;
    const x = (index: number) => (index / (SAMPLES - 1)) * 1000;
    const y = (value: number) => 6 + (1 - value / top) * (HEIGHT - 6);
    const line = (values: readonly number[]) =>
      values
        .map(
          (value, index) =>
            `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`,
        )
        .join(" ");
    return {
      bands: ahead.bands.map((band, index) => {
        const { upper, lower } = stacked[index]!;
        const back = lower
          .map((value, at) => `L${x(at).toFixed(1)},${y(value).toFixed(1)}`)
          .reverse()
          .join(" ");
        return {
          id: band.id,
          area: `${line(upper)} ${back} Z`,
          edge: line(upper),
        };
      }),
      total: line(total),
      baseline: line(resampleSeries(without.total, SAMPLES)),
      endY: y(end),
    };
  }, [ahead, without, end]);
  const morph = still ? { duration: 0 } : MORPH;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center">
      <div className="flex flex-col gap-6">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t("futurePlan.horizon")}
        >
          {YEAR_AHEAD_HORIZONS.map((each) => (
            <Chip
              key={each}
              active={each === horizon}
              onClick={() => setHorizon(each)}
            >
              {each < 12
                ? t("futurePlan.horizonMonths", { count: each })
                : t("futurePlan.years", { count: each / 12 })}
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
          {TARGETS.map((id) => (
            <Chip key={id} active={id === to} onClick={() => setTo(id)}>
              {name(id)}
            </Chip>
          ))}
        </div>
        <p className="min-h-6 text-sm text-marketing-muted" aria-live="polite">
          {extra > 0
            ? t("futurePlan.whatIfResultBy", {
                amount: money(gain),
                month: endLabel,
              })
            : t("futurePlan.whatIfNone")}
        </p>
        <p className="text-xs text-marketing-faint">{copy.note}</p>
      </div>

      {/* First on a phone, so the bands move in sight of the finger on
          the slider under them. */}
      <div className="order-first md:order-none">
        <p className="text-lg text-marketing-muted">
          {horizon < 12
            ? t("futurePlan.inMonthsTitle", { count: horizon })
            : t("futurePlan.inYearsTitle", { count: horizon / 12 })}
        </p>
        <p className="mt-1 font-serif text-[clamp(2.75rem,7vw,4.75rem)] font-semibold leading-none tracking-[-0.035em] text-primary-ink">
          <Count value={end} format={money} />
        </p>
        <p className="mt-2 text-sm text-marketing-muted">
          {t("futurePlan.yearAllGrounded", { month: endLabel })}
        </p>

        <div className="relative mt-6 w-full" style={{ height: HEIGHT }}>
          <svg
            viewBox={`0 0 1000 ${HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            aria-hidden
          >
            {shape.bands.map((band) => (
              <g key={band.id}>
                <m.path
                  initial={false}
                  animate={{ d: band.area }}
                  transition={morph}
                  fill={color(band.id)}
                  fillOpacity={0.38}
                />
                <m.path
                  initial={false}
                  animate={{ d: band.edge }}
                  transition={morph}
                  fill="none"
                  stroke={color(band.id)}
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
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
          {ahead.bands.map((band) => (
            <li
              key={band.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2 text-marketing-muted">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: color(band.id) }}
                />
                <span className="truncate">{name(band.id)}</span>
              </span>
              <Count
                value={band.values[months] ?? 0}
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
