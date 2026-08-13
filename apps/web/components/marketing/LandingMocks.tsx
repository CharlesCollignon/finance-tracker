"use client";

import type { ReactNode } from "react";
import { formatEuro } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { WEEKDAY_LABELS, formatShortAmount } from "@finance/core/calendar";
import { StatHero } from "@/components/finance/StatHero";
import { ProgressRing } from "@/components/finance/lazy-charts";
import FadeContent from "@/components/react-bits/FadeContent";
import CountUp from "@/components/react-bits/CountUp";
import {
  landingCopy,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { landingSample } from "@/components/marketing/landing-sample";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

function EuroCountUp({
  value,
  prefix = "",
}: {
  value: number;
  prefix?: string;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return (
      <>
        {prefix}
        {formatEuro(value)}
      </>
    );
  }
  return (
    <>
      {prefix}
      <CountUp
        from={0}
        to={value}
        separator=" "
        direction="up"
        duration={1}
        delay={0}
      />
      {" €"}
    </>
  );
}

export function HomeMock({
  variant = "web",
}: {
  variant?: "web" | "mobile";
}) {
  const { remaining, income, spent, monthLabel, onBudgetLabel, budget, goal } =
    landingSample;
  const compact = variant === "mobile";

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center bg-background",
        compact ? "gap-5 px-4 pt-8 pb-6" : "gap-8 px-8 py-10",
      )}
    >
      {compact ? (
        <p className="font-logo text-lg leading-none">Pluclair</p>
      ) : null}
      <StatHero
        size={compact ? "md" : "lg"}
        label={`Left in ${monthLabel}`}
        amount={<EuroCountUp value={remaining} />}
        amountClassName="text-primary"
        subtitle={
          <p>
            <span className="privacy-amount text-success tabular-nums">
              {formatEuro(income)}
            </span>
            {" earned · "}
            <span className="privacy-amount text-destructive tabular-nums">
              {formatEuro(spent)}
            </span>
            {" spent"}
          </p>
        }
        status={<span className="text-success">{onBudgetLabel}</span>}
      />
      <div
        className={cn(
          "flex flex-wrap justify-center",
          compact ? "gap-4" : "gap-6 md:gap-8",
        )}
      >
        <ProgressRing
          ratio={budget.spent / budget.limit}
          label={budget.label}
          detail={`${formatEuro(budget.spent)} / ${formatEuro(budget.limit)}`}
        />
        <ProgressRing
          ratio={goal.saved / goal.target}
          label={goal.label}
          detail={`${formatEuro(goal.saved)} / ${formatEuro(goal.target)}`}
          colorVar="--info"
          colorFallback="#2563eb"
        />
      </div>
    </div>
  );
}

function TransactionsMock() {
  const { remaining, income, spent } = landingSample;

  return (
    <StatHero
      size="md"
      label="What's left"
      amount={<EuroCountUp value={remaining} prefix="+" />}
      amountClassName="text-success"
      subtitle={
        <p>
          <span className="privacy-amount text-success tabular-nums">
            {formatEuro(income)}
          </span>
          {" in · "}
          <span className="privacy-amount text-destructive tabular-nums">
            {formatEuro(spent)}
          </span>
          {" out"}
        </p>
      }
    />
  );
}

function RecurringMock() {
  return (
    <ul className="mx-auto flex w-full max-w-xs flex-col items-stretch gap-3">
      {landingSample.templates.map((item) => (
        <li
          key={item.name}
          className="flex items-baseline justify-between gap-8 text-sm"
        >
          <span>{item.name}</span>
          <span
            className={cn(
              "privacy-amount tabular-nums",
              TYPE_AMOUNT_CLASS[item.type],
            )}
          >
            {item.amount >= 0 ? "+" : "−"}
            {formatEuro(Math.abs(item.amount))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CalendarMock() {
  return (
    <div className="w-full max-w-sm" aria-hidden>
      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label.charAt(0)}
          </div>
        ))}
        {landingSample.calendarDays.map((entry) => (
          <div
            key={entry.day}
            className="flex min-h-12 flex-col items-center py-1"
          >
            <span className="text-sm font-semibold leading-none">
              {entry.day}
            </span>
            {entry.amount != null ? (
              <span
                className={cn(
                  "mt-1 text-[10px] font-medium tabular-nums",
                  entry.amount > 0 ? "text-success" : "text-destructive",
                )}
              >
                {entry.amount > 0 ? "+" : "−"}
                {formatShortAmount(Math.abs(entry.amount))}€
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletsMock() {
  const { portfolio, portfolioInvested } = landingSample;

  return (
    <StatHero
      size="md"
      label="Portfolio"
      amount={<EuroCountUp value={portfolio} />}
      amountClassName="text-primary"
      subtitle={
        <p>
          <span className="privacy-amount tabular-nums">
            {formatEuro(portfolioInvested)}
          </span>
          {" invested"}
        </p>
      }
    />
  );
}

function PlanningMock() {
  const { budget } = landingSample;

  return (
    <ProgressRing
      ratio={budget.spent / budget.limit}
      label={budget.label}
      detail={`${formatEuro(budget.spent)} / ${formatEuro(budget.limit)}`}
    />
  );
}

const PAGE_MOCKS: Record<LandingPageId, () => ReactNode> = {
  home: () => <HomeMock />,
  transactions: () => <TransactionsMock />,
  recurring: () => <RecurringMock />,
  calendar: () => <CalendarMock />,
  wallets: () => <WalletsMock />,
  planning: () => <PlanningMock />,
};

function MotionFade({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <FadeContent
      className={className}
      duration={0.6}
      delay={delay}
      threshold={0.15}
    >
      {children}
    </FadeContent>
  );
}

export function FeatureMock({ pageId }: { pageId: LandingPageId }) {
  if (pageId === "home") {
    return <HomeMock variant="mobile" />;
  }
  const Mock = PAGE_MOCKS[pageId];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background px-4 py-10">
      <Mock />
    </div>
  );
}

export function LandingHowItWorks() {
  return (
    <div className="flex flex-col items-center gap-12 text-center">
      <MotionFade>
        <h2 className="font-head text-sm font-medium text-muted-foreground">
          {landingCopy.how.heading}
        </h2>
      </MotionFade>
      {landingCopy.how.beats.map((beat, index) => (
        <MotionFade key={beat.title} className="max-w-md" delay={index * 0.08}>
          <h3 className="font-head text-xl tracking-tight md:text-2xl">
            {beat.title}
          </h3>
          <p className="mt-3 text-base text-muted-foreground">{beat.body}</p>
        </MotionFade>
      ))}
      <MotionFade className="max-w-md" delay={0.24}>
        <p className="text-sm text-muted-foreground">
          {landingCopy.how.footnote}
        </p>
      </MotionFade>
    </div>
  );
}
