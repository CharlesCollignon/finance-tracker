"use client";

import type { ReactNode } from "react";
import { ChartLineUp, Fire, Trophy } from "@phosphor-icons/react";
import { CUSHION_TARGETS } from "@finance/core/future-plan";
import { TRAJECTORY_YEARS } from "@finance/core/history/plan-accounts";
import {
  historyMonthLabel,
  trajectoryAccountKey,
} from "@finance/core/history/plan-figures";
import { formatMonthLabel, formatPercentLabel } from "@finance/core/constants";
import { niceTicks } from "@finance/core/year-ahead";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { MOCK_GLASS } from "@/components/marketing/mocks/bearing";
import {
  sampleAccountRows,
  sampleCushion,
  sampleMilestones,
  sampleTrajectory,
} from "@/components/marketing/plan-sample";
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
 * page is, « Votre trajectoire » across the page — the middle start in ten
 * years, the band, the worst start, the chart, and under it « Vos comptes »,
 * the accounts the line is made of — then « Progression », as `PlanView`
 * lays them out. Every figure is the app's engine on the landing's sample
 * (`../plan-sample.ts`).
 */

/** The horizon the mock shows. */
const YEARS = 10;
/** The sample's month, March 2026: where « today » is. */
const SAMPLE_YEAR = 2026;
const SAMPLE_MONTH = 3;

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
 * The middle start as one gold line inside the band eight starts in ten end
 * in, with a few round amounts as labelled lines — the card's chart, at rest.
 */
function Band({
  low,
  middle,
  high,
  height,
  euro,
}: {
  low: readonly number[];
  middle: readonly number[];
  high: readonly number[];
  height: number;
  euro: (amount: number) => string;
}) {
  const values = [...low, ...middle, ...high];
  const pad = (Math.max(...values) - Math.min(...values)) * 0.05 || 1;
  const min = Math.min(...values) - pad;
  const max = Math.max(...values) + pad;
  const width = 1000;
  const x = (index: number) => (index / (middle.length - 1)) * width;
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
          d={line(middle)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/**
 * « Votre trajectoire », as the card is: ten years on the middle start, the
 * band, the value after tax, the worst start, the chart, and the accounts
 * under it.
 */
function Trajectory({ compact }: { compact: boolean }) {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const money = (value: number) => euro(Math.round(value));
  const { result, today, afterTax } = sampleTrajectory(YEARS);
  const horizons = (
    <Switch
      options={TRAJECTORY_YEARS.map((each) =>
        t("futurePlan.years", { count: each }),
      )}
      on={TRAJECTORY_YEARS.indexOf(YEARS)}
    />
  );

  return (
    <PlanCardFrame
      icon={<ChartLineUp size={14} weight="bold" />}
      title={t("trajectory.title")}
      aside={compact ? undefined : horizons}
      className={compact ? undefined : "p-6"}
    >
      {compact ? horizons : null}
      <div>
        <p className="text-sm text-muted-foreground">
          {t("futurePlan.inYearsTitle", { count: YEARS })}
        </p>
        <p
          className={cn(
            "font-serif font-semibold leading-[0.95] tracking-tight tabular-nums text-primary-ink",
            compact ? "text-[2.75rem]" : "text-6xl",
          )}
        >
          {money(result.end.p50)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("trajectory.medianCaption")}
        </p>
        <p className="mt-3 text-sm tabular-nums">
          {t("trajectory.rangeLine", {
            low: money(result.end.p10),
            high: money(result.end.p90),
          })}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("trajectory.afterTax", { amount: money(afterTax) })}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("trajectory.worstLine", {
            month: historyMonthLabel(result.worst.start, locale),
            amount: money(result.worst.value),
          })}
        </p>
      </div>
      <div>
        <Band
          low={[today, ...result.band.p10]}
          middle={[today, ...result.band.p50]}
          high={[today, ...result.band.p90]}
          height={compact ? 120 : 150}
          euro={euro}
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{t("futurePlan.today")}</span>
          <span>{SAMPLE_YEAR + YEARS}</span>
        </div>
      </div>
      <Accounts compact={compact} />
    </PlanCardFrame>
  );
}

/**
 * « Vos comptes », under the chart: each of the sample's accounts with what
 * it holds, what goes in each month and what its history returned, in
 * field-like boxes because in the app each is the reader's to change; then
 * where the chart starts.
 */
function Accounts({ compact }: { compact: boolean }) {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const rows = sampleAccountRows();
  const total = rows.reduce((sum, row) => sum + row.today, 0);
  const monthly = rows.reduce((sum, row) => sum + row.monthly, 0);
  const grid = compact
    ? "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2"
    : "grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] items-center gap-3";
  const box = "rounded-control border border-border px-2 py-1.5 tabular-nums";
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <p className="text-sm font-medium">{t("trajectory.accountsTitle")}</p>
        {compact ? null : (
          <p className="max-w-prose text-xs text-muted-foreground">
            {t("trajectory.accountsLead")}
          </p>
        )}
      </div>
      <div className={cn(grid, "text-[0.65rem] text-muted-foreground")}>
        <span>{t("trajectory.accountColumn")}</span>
        <span>{t("futurePlan.fieldInitial")}</span>
        <span>{t("futurePlan.fieldMonthly")}</span>
        {compact ? null : <span>{t("futurePlan.fieldReturn")}</span>}
      </div>
      <ul className="flex flex-col gap-1.5 text-xs">
        {rows.map((row) => (
          <li key={row.id} className={grid}>
            <span className="truncate">{t(trajectoryAccountKey(row.id))}</span>
            <span className={box}>{euro(Math.round(row.today))}</span>
            <span className={box}>{euro(Math.round(row.monthly))}</span>
            {compact ? null : (
              <span className={box}>
                {row.id === "current"
                  ? formatPercentLabel(0, locale)
                  : row.annualReturn === null
                    ? "—"
                    : formatPercentLabel(
                        Math.round(row.annualReturn * 1000) / 10,
                        locale,
                      )}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div
        className={cn(grid, "border-t border-border pt-2 text-xs font-medium")}
      >
        <span>{t("trajectory.totalLine")}</span>
        <span className="tabular-nums">{euro(Math.round(total))}</span>
        <span className="tabular-nums">
          {t("futurePlan.whatIfPerMonth", {
            amount: euro(Math.round(monthly)),
          })}
        </span>
      </div>
    </div>
  );
}

/** « Progression »: the milestones passed, the next one, the cushion, the run. */
function Progression({ compact }: { compact: boolean }) {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { close } = landingSampleFor(locale);
  const milestones = sampleMilestones();
  const cushion = sampleCushion();
  const reached = milestones.filter((each) => each.reached);
  const next = milestones.find((each) => !each.reached)!;
  const months = (count: number) => t("futurePlan.cushionMonths", { count });
  const at = SAMPLE_MONTH - 1 + (next.monthsAway ?? 0);
  return (
    <PlanCardFrame
      icon={<Trophy size={14} weight="fill" />}
      title={t("trajectory.progressionTitle")}
    >
      <div
        className={compact ? "flex flex-col gap-4" : "grid grid-cols-3 gap-6"}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("trajectory.milestonesReached")}
            </span>
            {reached.map((each) => (
              <span
                key={each.amount}
                className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground tabular-nums"
              >
                {euro(each.amount)}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">
                {t("trajectory.nextMilestone", { amount: euro(next.amount) })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("trajectory.milestoneWhen", {
                  month: formatMonthLabel(
                    SAMPLE_YEAR + Math.floor(at / 12),
                    (at % 12) + 1,
                    locale,
                  ),
                })}
              </p>
            </div>
            <div className="h-2 rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-foreground/60"
                style={{
                  width: `${Math.min(100, (reached.at(-1)!.amount / next.amount) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
        <div
          className={cn(
            "flex flex-col gap-2",
            compact
              ? "border-t border-border pt-3"
              : "border-l border-border pl-6",
          )}
        >
          <p className="text-sm font-medium">{t("trajectory.cushionLabel")}</p>
          <div className="flex gap-1.5">
            {CUSHION_TARGETS.map((target, index) => (
              <span
                key={target}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  cushion.level > index ? "bg-primary" : "bg-foreground/10",
                )}
              />
            ))}
          </div>
          {cushion.nextTarget !== null ? (
            <p className="text-xs text-muted-foreground">
              {t("futurePlan.cushionNext", {
                months: months(cushion.nextTarget),
              })}
            </p>
          ) : null}
        </div>
        <p
          className={cn(
            "flex items-center gap-2 text-sm",
            compact
              ? "border-t border-border pt-3"
              : "items-start border-l border-border pl-6",
          )}
        >
          <Fire size={18} weight="fill" className="text-primary" />
          {t("bearingMonth.run", { count: close.streak })}
        </p>
      </div>
    </PlanCardFrame>
  );
}

export function PlanningMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.plan">
        <p className="text-sm text-muted-foreground">{t("trajectory.intro")}</p>
        <Trajectory compact />
        <Progression compact />
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.plan">
      <p className="text-sm text-muted-foreground">{t("trajectory.intro")}</p>
      <Trajectory compact={false} />
      <Progression compact={false} />
    </WebShell>
  );
}
