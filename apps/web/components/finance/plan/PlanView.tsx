"use client";

import { useEffect, useState } from "react";
import { ConnectBankInvite } from "@/components/finance/bank/ConnectBankInvite";
import { GLASS_CARD } from "@/lib/glass";
import { useT } from "@/lib/locale-context";
import type { PlanBase, PlanWealth } from "@/lib/queries/plan";
import { cn } from "@/lib/utils";
import { PlanAccounts } from "./PlanAccounts";
import {
  savePlanEdits,
  saveTrajectorySettings,
  usePlanEdits,
  useTrajectorySettings,
} from "./plan-storage";
import { ProgressionCard } from "./ProgressionCard";
import { TrajectoryCard } from "./TrajectoryCard";
import { usePlanReplay } from "./use-plan-replay";

interface PlanViewProps {
  base: PlanBase;
  /** The investment accounts at market prices, streaming in after the rest. */
  wealth: Promise<PlanWealth | null>;
  /** Whether to invite a reader with no bank connected to connect one. */
  bankInvite: boolean;
}

/**
 * Plan: where the money could go, replayed on what markets actually did.
 *
 * Two cards since October 2026 (docs/plans/PLAN_REDESIGN_PLAN.md):
 * « Votre trajectoire », the accounts replayed from every start since 1970,
 * with « Vos comptes » under the chart — every figure the line is made of,
 * the reader's to change; then « Progression », the milestones, the cushion
 * and the run. The month close lives on Le point.
 *
 * The page arrives at once and holds still: no card waits to be scrolled
 * to. It is drawn once the investments' market value has come, because
 * every card counts them and a figure that jumps when they land is one
 * nobody trusts; the cards' shapes stand in until then.
 */
export function PlanView({ base, wealth, bankInvite }: PlanViewProps) {
  const { done, value } = useSettled(wealth);
  const t = useT();

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <p className="text-sm text-muted-foreground">{t("trajectory.intro")}</p>
      {done ? (
        <PlanCards base={base} wealth={value} />
      ) : (
        <div className="flex flex-col gap-4 md:gap-5">
          <CardPlaceholder rows={7} />
          <CardPlaceholder rows={2} />
        </div>
      )}
      {/* Last, because a connected bank is what makes the figures above the
          reader's own. */}
      {bankInvite ? <ConnectBankInvite surface="plan" /> : null}
    </div>
  );
}

function PlanCards({
  base,
  wealth,
}: {
  base: PlanBase;
  wealth: PlanWealth | null;
}) {
  const settings = useTrajectorySettings(base.userId);
  const edits = usePlanEdits(base.userId);

  const hasProperty = (base.properties?.length ?? 0) > 0;
  const replay = usePlanReplay({
    base,
    wealth,
    edits,
    years: settings.years,
    withProperty: settings.withProperty && hasProperty,
  });

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <TrajectoryCard
        replay={replay}
        years={settings.years}
        onYears={(years) =>
          saveTrajectorySettings(base.userId, { ...settings, years })
        }
        hasProperty={hasProperty}
        withProperty={settings.withProperty}
        onWithProperty={(withProperty) =>
          saveTrajectorySettings(base.userId, { ...settings, withProperty })
        }
      >
        <PlanAccounts
          replay={replay}
          edits={edits}
          onEdits={(next) => savePlanEdits(base.userId, next)}
          properties={base.properties}
          today={base.today}
          years={settings.years}
        />
      </TrajectoryCard>
      <ProgressionCard
        milestones={replay.milestones}
        wealth={replay.wealth}
        cushion={replay.cushion}
        run={base.run}
        seen={base.milestoneSeen}
        year={base.year}
        month={base.month}
      />
    </div>
  );
}

/**
 * A promise's value without suspending: `done` turns true when it settles,
 * and a rejection reads as null, as `gatherPlanWealth` itself does.
 */
function useSettled<T>(promise: Promise<T | null>): {
  done: boolean;
  value: T | null;
} {
  const [settled, setSettled] = useState<{
    promise: Promise<T | null>;
    value: T | null;
  } | null>(null);

  useEffect(() => {
    let live = true;
    promise.then(
      (value) => live && setSettled({ promise, value }),
      () => live && setSettled({ promise, value: null }),
    );
    return () => {
      live = false;
    };
  }, [promise]);

  return settled?.promise === promise
    ? { done: true, value: settled.value }
    : { done: false, value: null };
}

/** A card's shape while what it needs is on its way. */
function CardPlaceholder({
  rows,
  className,
}: {
  rows: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        GLASS_CARD,
        "flex h-full flex-col gap-3 rounded-card p-card",
        className,
      )}
    >
      <div className="h-7 w-40 animate-pulse rounded-control bg-muted/40" />
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-10 w-full animate-pulse rounded-control bg-muted/40"
        />
      ))}
    </div>
  );
}
