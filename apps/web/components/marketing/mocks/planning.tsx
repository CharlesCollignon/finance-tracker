"use client";

import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  MobileShell,
  MockCard,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/** The Plan, as a landing mock (`./frame.tsx`). */

/* ---------------------------------------------------------------- planning */

/** The Plan page's milestones: what is reached, and when the next ones are. */
function MilestoneList() {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  return (
    <ul className="flex flex-col gap-3">
      {sample.plan.milestones.map((milestone) => (
        <li
          key={milestone.amount}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full",
                milestone.monthsAway === 0
                  ? "bg-primary"
                  : "border border-[var(--hairline-strong)]",
              )}
            />
            <span className="font-mono tabular-nums">
              {euro(milestone.amount)}
            </span>
          </span>
          <span className="text-muted-foreground">
            {milestone.monthsAway === 0
              ? t("futurePlan.milestoneReached")
              : t("futurePlan.milestoneIn", { count: milestone.monthsAway })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The cushion: months of fixed costs covered, against the six to aim for. */
function CushionBar() {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const months = t("futurePlan.cushionMonths", {
    count: sample.plan.cushionMonths,
  });
  return (
    <div>
      <p className="text-sm font-medium">
        {t("futurePlan.cushionBody", { months })}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--hairline-strong)]">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(sample.plan.cushionMonths / 6) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function PlanningMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { plan } = sample;

  const yearAhead = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("futurePlan.yearTitle")}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
        {euro(plan.yearAhead)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("futurePlan.yearGrounded", { month: plan.byLabel })}
      </p>
    </>
  );

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.plan">
        <MockCard innerClassName="p-4">{yearAhead}</MockCard>
        <MockCard innerClassName="flex flex-col gap-3 p-4">
          <p className="text-sm font-bold">{t("futurePlan.milestonesTitle")}</p>
          <MilestoneList />
        </MockCard>
        <MockCard innerClassName="p-4">
          <CushionBar />
        </MockCard>
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.plan">
      <div className="grid grid-cols-2 gap-4">
        <MockCard innerClassName="flex h-full flex-col justify-between gap-5 px-6 py-5">
          <div>{yearAhead}</div>
          <CushionBar />
        </MockCard>
        <MockCard innerClassName="flex h-full flex-col gap-4 px-6 py-5">
          <p className="font-head text-base">
            {t("futurePlan.milestonesTitle")}
          </p>
          <MilestoneList />
        </MockCard>
      </div>
    </WebShell>
  );
}
