"use client";

import type { ReactNode } from "react";
import { CalendarCheck, ShieldCheck, Trophy } from "@phosphor-icons/react";
import { formatMonthCompact, formatMonthLabel } from "@finance/core/constants";
import { CUSHION_TARGETS } from "@finance/core/future-plan";
import {
  niceTicks,
  YEAR_AHEAD_HORIZONS,
  type YearAhead as YearAheadData,
} from "@finance/core/year-ahead";
import {
  accountColors,
  accountNameKey,
} from "@/components/finance/plan/year-ahead-parts";
import { Orb } from "@/components/brand/Orb";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { MOCK_GLASS } from "@/components/marketing/mocks/bearing";
import {
  SAMPLE_ENVELOPES,
  sampleYearAhead,
} from "@/components/marketing/year-ahead-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  MobileShell,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/**
 * The Plan, as a landing mock (`./frame.tsx`): the line that says what the
 * page is, the year ahead across the page — its figure, one band per
 * account under the gold total, the accounts, and « Pourquoi » open — then
 * « Vos paliers » beside « Votre matelas de sécurité », as `PlanView` lays
 * them out.
 */

/** A card of the Plan with its round icon and name, as `PlanCard` draws it. */
export function PlanCardFrame({
  icon,
  title,
  aside,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  /** Beside the title, at the end of the row. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(MOCK_GLASS, "flex flex-col gap-4 p-5", className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
            {icon}
          </span>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

const color = accountColors(SAMPLE_ENVELOPES);

/**
 * The gold total in its shaded range, at rest, zoomed on where the money is
 * with a few round amounts as labelled lines — the card's chart.
 */
function YearRange({
  ahead,
  height,
  euro,
}: {
  ahead: YearAheadData;
  height: number;
  euro: (amount: number) => string;
}) {
  const samples = ahead.total.length;
  const low = ahead.range?.low ?? ahead.total;
  const high = ahead.range?.high ?? ahead.total;
  const values = [...ahead.total, ...low, ...high];
  const pad = (Math.max(...values) - Math.min(...values)) * 0.08 || 1;
  const min = Math.min(...values) - pad;
  const max = Math.max(...values) + pad;
  const width = 1000;
  const x = (index: number) => (index / (samples - 1)) * width;
  const y = (value: number) =>
    6 + ((max - value) / (max - min)) * (height - 12);
  const line = (series: readonly number[]) =>
    series
      .map(
        (value, index) =>
          `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`,
      )
      .join(" ");
  const back = low
    .map((value, index) => `L${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
    .reverse()
    .join(" ");
  return (
    <div className="relative w-full" style={{ height }}>
      {niceTicks(min, max).map((tick) => (
        <div
          key={tick}
          className="absolute inset-x-0 border-t border-hairline"
          style={{ top: y(tick) }}
        >
          <span className="absolute -top-4 left-0 text-[0.65rem] tabular-nums text-muted-foreground">
            {euro(tick)}
          </span>
        </div>
      ))}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <path
          d={`${line(high)} ${back} Z`}
          fill="var(--primary)"
          fillOpacity={0.16}
        />
        <path
          d={line(ahead.total)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: "100%", top: y(ahead.total[samples - 1]!) }}
      />
    </div>
  );
}

/** An account's curve from today, on the scale every row shares. */
function Spark({
  values,
  scale,
  color: stroke,
}: {
  values: readonly number[];
  scale: { up: number; down: number };
  color: string;
}) {
  const span = scale.up + scale.down || 1;
  const level = 3 + (scale.up / span) * 22;
  const start = values[0] ?? 0;
  const d = values
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${((index / (values.length - 1)) * 80).toFixed(1)},${(level - ((value - start) / span) * 22).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20 overflow-visible">
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A row of choices with the one picked lit, as the card's switches are. */
function Switch({ options, on }: { options: string[]; on: number }) {
  return (
    <span className="flex w-fit rounded-full border border-border p-0.5">
      {options.map((option, index) => (
        <span
          key={option}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium tabular-nums",
            index === on ? "bg-muted text-foreground" : "text-muted-foreground",
          )}
        >
          {option}
        </span>
      ))}
    </span>
  );
}

/**
 * « Dans un an », as the card now is: the figure over every account with
 * its range and its value after tax, the gold line in its range, the
 * accounts as rows with their curves, and « Pourquoi » open on a month's
 * income cut into where it goes.
 */
function YearAhead({ compact }: { compact: boolean }) {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { plan } = landingSampleFor(locale);
  const { ahead } = sampleYearAhead(locale);
  const end = ahead.total[ahead.months]!;
  const name = (id: Parameters<typeof accountNameKey>[0]) =>
    t(accountNameKey(id));
  const horizons = (
    <Switch
      options={YEAR_AHEAD_HORIZONS.map((horizon) =>
        horizon < 12
          ? t("futurePlan.horizonMonths", { count: horizon })
          : t("futurePlan.years", { count: horizon / 12 }),
      )}
      on={YEAR_AHEAD_HORIZONS.indexOf(12)}
    />
  );
  const rows = [
    {
      key: "committed",
      label: t("futurePlan.flowCommitted"),
      amount: -ahead.flow.committed,
      color: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
    },
    {
      key: "everyday",
      label: t("futurePlan.flowEveryday"),
      amount: -ahead.flow.everyday,
      color: "color-mix(in oklab, var(--muted-foreground) 28%, transparent)",
    },
    ...ahead.flow.into.map((row) => ({
      key: row.id,
      label: name(row.id),
      amount: row.monthly,
      color: color(row.id),
    })),
    {
      key: "current",
      label: t("futurePlan.flowCurrentStays"),
      amount: ahead.flow.current,
      color: color("current"),
    },
  ];
  const signed = (value: number) =>
    `${value >= 0 ? "+" : "−"}${euro(Math.abs(Math.round(value)))}`;
  const changes = ahead.bands.flatMap((band) =>
    band.values.map((value) => value - band.values[0]!),
  );
  const scale = {
    up: Math.max(0, ...changes),
    down: Math.max(0, ...changes.map((change) => -change)),
  };

  return (
    <PlanCardFrame
      icon={<CalendarCheck size={14} weight="fill" />}
      title={t("futurePlan.yearTitle")}
      aside={compact ? undefined : horizons}
      className={compact ? undefined : "p-6"}
    >
      {compact ? horizons : null}
      <div>
        <p
          className={cn(
            "font-serif font-semibold leading-[0.95] tracking-tight tabular-nums text-primary-ink",
            compact ? "text-[2.75rem]" : "text-6xl",
          )}
        >
          {euro(Math.round(end))}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("futurePlan.yearAllGrounded", { month: plan.byLabel })}
        </p>
        {ahead.range ? (
          <p className="text-sm text-muted-foreground">
            {t("futurePlan.rangeLine", {
              low: euro(Math.round(ahead.range.low[ahead.months]!)),
              high: euro(Math.round(ahead.range.high[ahead.months]!)),
            })}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {t("futurePlan.afterTaxLine", {
            amount: euro(Math.round(ahead.afterTax.total)),
          })}
        </p>
        <p className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex h-4 w-7 items-center rounded-full bg-foreground/20 px-0.5">
            <span className="size-3 rounded-full bg-background" />
          </span>
          {t("futurePlan.realTerms")}
        </p>
      </div>
      <div>
        <YearRange ahead={ahead} height={compact ? 120 : 130} euro={euro} />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{t("futurePlan.today")}</span>
          <span>{formatMonthCompact(2027, 3, locale)}</span>
        </div>
      </div>
      <ul
        className={cn("grid gap-x-10", compact ? "grid-cols-1" : "grid-cols-2")}
      >
        {ahead.bands.map((band) => {
          const today = band.values[0]!;
          const atEnd = band.values[ahead.months]!;
          return (
            <li
              key={band.id}
              className="flex min-h-11 items-center gap-3 text-sm"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: color(band.id) }}
              />
              <span className="min-w-0 flex-1 truncate">{name(band.id)}</span>
              {compact ? null : (
                <Spark
                  values={band.values}
                  scale={scale}
                  color={color(band.id)}
                />
              )}
              <span className="flex flex-col items-end tabular-nums">
                <span>
                  {compact ? null : (
                    <span className="text-muted-foreground">
                      {euro(Math.round(today))} →{" "}
                    </span>
                  )}
                  <span className="font-medium">{euro(Math.round(atEnd))}</span>
                </span>
                <span className="text-[0.65rem] text-muted-foreground">
                  {signed(atEnd - today)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <Switch
          options={[t("futurePlan.whyTitle"), t("futurePlan.whatIfTitle")]}
          on={0}
        />
        <p className="text-sm text-muted-foreground">
          {t("futurePlan.whyLeadIncome", { amount: euro(ahead.flow.income) })}
        </p>
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
          {rows.map((row) => (
            <span
              key={row.key}
              className="h-full"
              style={{
                width: `${(Math.abs(row.amount) / ahead.flow.income) * 100}%`,
                background: row.color,
              }}
            />
          ))}
        </div>
        <ul
          className={cn(
            "grid gap-x-10 gap-y-1.5",
            compact ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: row.color }}
                />
                {row.label}
              </span>
              <span className="tabular-nums">{signed(row.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </PlanCardFrame>
  );
}

/** « Vos paliers »: the one reached as a pill, the next ones with their bar. */
function Milestones() {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { plan } = landingSampleFor(locale);
  const reached = plan.milestones.filter((each) => each.monthsAway === 0);
  const ahead = plan.milestones.filter((each) => each.monthsAway > 0);
  // From March 2026, the sample's month.
  const when = (monthsAway: number) => {
    const index = 2 + monthsAway;
    return formatMonthLabel(
      2026 + Math.floor(index / 12),
      (index % 12) + 1,
      locale,
    );
  };
  return (
    <PlanCardFrame
      icon={<Trophy size={14} weight="fill" />}
      title={t("futurePlan.milestonesTitle")}
    >
      <p className="-mt-2 text-xs text-muted-foreground">
        {t("futurePlan.milestonesBasis")}
      </p>
      <ul className="flex flex-wrap gap-3">
        {reached.map((milestone) => (
          <li
            key={milestone.amount}
            className="flex items-center gap-3 rounded-full border border-primary/25 bg-accent py-1.5 pl-1.5 pr-4"
          >
            <Orb size="28px" tone="mark" />
            <span className="flex flex-col">
              <span className="font-serif text-base font-semibold leading-tight tabular-nums">
                {euro(milestone.amount)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("futurePlan.milestoneReached")}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col">
        {ahead.map((milestone) => (
          <li
            key={milestone.amount}
            className="border-b border-border py-3 first:pt-0 last:border-0 last:pb-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-serif text-lg font-semibold tabular-nums">
                {euro(milestone.amount)}
              </span>
              <span className="text-sm text-muted-foreground">
                {`${t("futurePlan.milestoneIn", { count: milestone.monthsAway })} · ${when(milestone.monthsAway)}`}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-foreground/60"
                style={{
                  width: `${Math.min(100, (plan.towards / milestone.amount) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </PlanCardFrame>
  );
}

/** « Votre matelas de sécurité »: months covered, on the 1 · 3 · 6 rungs. */
function Cushion() {
  const t = useT();
  const { plan } = landingSampleFor(useLocale());
  const last = CUSHION_TARGETS[CUSHION_TARGETS.length - 1]!;
  const months = (count: number) => t("futurePlan.cushionMonths", { count });
  const next = CUSHION_TARGETS.find((target) => target > plan.cushionMonths);
  return (
    <PlanCardFrame
      icon={<ShieldCheck size={14} weight="fill" />}
      title={t("futurePlan.cushionTitle")}
    >
      <p className="font-head text-lg">
        {t("futurePlan.cushionBody", { months: months(plan.cushionMonths) })}
      </p>
      <div className="px-2 pb-6 pt-2">
        <div className="relative h-2 rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-foreground/60"
            style={{ width: `${(plan.cushionMonths / last) * 100}%` }}
          />
          {CUSHION_TARGETS.map((target, index) => {
            const lit = plan.cushionMonths >= target;
            return (
              <span
                key={target}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${(target / last) * 100}%` }}
              >
                <span
                  className={cn(
                    "block size-4 rounded-full",
                    lit
                      ? "bg-primary shadow-[0_0_12px_rgb(236_178_94/0.7)]"
                      : "bg-card ring-2 ring-hairline-strong",
                  )}
                />
                <span
                  className={cn(
                    "absolute top-6 whitespace-nowrap text-xs",
                    index === CUSHION_TARGETS.length - 1
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2",
                    lit ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {months(target)}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      {next ? (
        <p className="text-sm">
          {t("futurePlan.cushionNext", { months: months(next) })}
        </p>
      ) : null}
    </PlanCardFrame>
  );
}

export function PlanningMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.plan">
        <p className="text-sm text-muted-foreground">{t("futurePlan.intro")}</p>
        <YearAhead compact />
        <Milestones />
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.plan">
      <p className="text-sm text-muted-foreground">{t("futurePlan.intro")}</p>
      <YearAhead compact={false} />
      <div className="grid grid-cols-2 items-start gap-4">
        <Milestones />
        <Cushion />
      </div>
    </WebShell>
  );
}
