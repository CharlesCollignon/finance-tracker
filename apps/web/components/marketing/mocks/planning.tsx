"use client";

import type { ReactNode } from "react";
import {
  CalendarCheck,
  ShieldCheck,
  Sparkle,
  Trophy,
} from "@phosphor-icons/react";
import { formatMonthLabel } from "@finance/core/constants";
import { CUSHION_TARGETS } from "@finance/core/future-plan";
import { Orb } from "@/components/brand/Orb";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { MOCK_GLASS } from "@/components/marketing/mocks/bearing";
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
 * page is, the year ahead across the page — its figure, its curve and
 * « Et si… » — then « Vos paliers » beside « Votre matelas de sécurité »,
 * as `PlanView` lays them out.
 */

/** A card of the Plan with its round icon and name, as `PlanCard` draws it. */
export function PlanCardFrame({
  icon,
  title,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(MOCK_GLASS, "flex flex-col gap-4 p-5", className)}>
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Twelve months ahead, rising as the plan has it, the gold wash under it. */
function YearCurve({ height }: { height: number }) {
  const values = [
    100, 108, 113, 121, 127, 134, 139, 147, 152, 160, 166, 174, 181,
  ];
  const width = 1000;
  const top = Math.max(...values) * 1.04;
  const bottom = Math.min(...values) * 0.8;
  const x = (index: number) => (index / (values.length - 1)) * width;
  const y = (value: number) =>
    4 + (1 - (value - bottom) / (top - bottom)) * (height - 8);
  const line = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(value)}`)
    .join(" ");
  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <linearGradient id="mock-year-wash" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${line} L${width} ${height} L0 ${height} Z`}
          fill="url(#mock-year-wash)"
        />
        <path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: "100%", top: y(values[values.length - 1]!) }}
      />
    </div>
  );
}

/** « Dans un an »: the figure, its curve, and « Et si… » at rest. */
function YearAhead({ compact }: { compact: boolean }) {
  const t = useT();
  const euro = useEuro();
  const { plan } = landingSampleFor(useLocale());
  return (
    <PlanCardFrame
      icon={<CalendarCheck size={14} weight="fill" />}
      title={t("futurePlan.yearTitle")}
      className={compact ? undefined : "p-8"}
    >
      <div>
        <p
          className={cn(
            "font-serif font-semibold leading-[0.95] tracking-tight tabular-nums text-primary-ink",
            compact ? "text-[2.75rem]" : "text-6xl",
          )}
        >
          {euro(plan.yearAhead)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("futurePlan.yearGrounded", { month: plan.byLabel })}
        </p>
      </div>
      <YearCurve height={compact ? 90 : 110} />
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="flex items-center gap-2 font-head text-base">
            <Sparkle size={16} weight="fill" className="text-primary" />
            {t("futurePlan.whatIfTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("futurePlan.whatIfLabel")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative h-1.5 min-w-0 flex-1 rounded-full bg-foreground/10">
            <span className="absolute left-0 top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
          </span>
          <span className="w-28 shrink-0 text-right text-sm font-medium tabular-nums text-muted-foreground">
            {t("futurePlan.whatIfPerMonth", { amount: euro(0) })}
          </span>
        </div>
        <div className="flex gap-2">
          {[50, 100, 200].map((amount) => (
            <span
              key={amount}
              className="rounded-full border border-border px-4 py-1.5 text-sm tabular-nums text-muted-foreground"
            >
              +{euro(amount)}
            </span>
          ))}
        </div>
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
