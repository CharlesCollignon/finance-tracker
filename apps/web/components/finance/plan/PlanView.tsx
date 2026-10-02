"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { CaretDown, GearSix, Sparkle } from "@phosphor-icons/react";
import {
  buildCushion,
  buildMilestones,
  cushionSavings,
  ENVELOPE_ORDER,
  monthsUntil,
  projectEnvelopes,
  type EnvelopeId,
  wealthToday,
} from "@finance/core/future-plan";
import { SAVINGS_KINDS } from "@finance/core/savings-accounts";
import type { SavingsAccountKind } from "@finance/core/types/database";
import { buildRunway } from "@finance/core/projection";
import { MonthCloseHistory } from "@/components/finance/MonthCloseHistory";
import { ConnectBankInvite } from "@/components/finance/bank/ConnectBankInvite";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { markMilestoneSeen } from "@/lib/actions/plan";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import type { PlanBase, PlanWealth } from "@/lib/queries/plan";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { HORIZON_MAX, LongViewCard } from "./LongViewCard";
import { CushionCard, MilestonesCard } from "./MilestonesCard";
import { monthLabelAhead } from "./plan-controls";
import { planEnvelopes } from "./plan-envelopes";
import { NetWorthCard, PropertyLongViewCard } from "./PropertyPlanCards";
import {
  clearLongViewDraft,
  saveLongViewDraft,
  useLongViewDraft,
  type LongViewDraft,
} from "./plan-storage";
import { MonthsCard, RunCard } from "./RunCard";
import { YearAheadCard } from "./YearAheadCard";

/** Where the long view opens, before the reader changes anything. */
const DEFAULT_YEARS = 20;
const DEFAULT_INFLATION = 0.02;
const DEFAULT_WITHDRAWAL = 0.04;

interface PlanViewProps {
  base: PlanBase;
  /** The investment accounts at market prices, streaming in after the rest. */
  wealth: Promise<PlanWealth | null>;
  /** Whether to invite a reader with no bank connected to connect one. */
  bankInvite: boolean;
}

/**
 * Plan: where the money is heading, and what keeps it going.
 *
 * Four things, in the order a returning reader wants them: a year from now
 * with a slider to play with; the milestones on the way and the cushion the
 * savings make; the long view, after French tax; and the run of month-ends
 * with what each one saved. With a property, net worth sits under the
 * cushion and the homes' own long view under the long view's — beside the
 * savings and investments, never counted in them. Budgets, goals and tags used to live here and are
 * gone; the month-close settings stay, folded away under the months.
 *
 * Drawn in two loads, as the phone draws it. The year ahead, the cushion and
 * the run need only the ledger and are here at once; the milestones and the
 * long view need the market value of the investment accounts, so they stream
 * in behind their own placeholders.
 */
export function PlanView({ base, wealth, bankInvite }: PlanViewProps) {
  const draft = useLongViewDraft(base.userId);
  const [extra, setExtra] = useState(0);

  // The cushion is the savings at hand — every declared account but a PEL,
  // or everything saved in one — the reader's corrections in the long view
  // included, against the fixed costs; or the user's own figures, when the
  // long view has had its savings taken out. The phone reads it the same way.
  const fromData = planEnvelopes(base, null);
  const draftSavings = draft?.envelopes.some((envelope) =>
    isSavingsEnvelope(envelope.id),
  );
  const runway = buildRunway(
    cushionSavings(draft && draftSavings ? draft.envelopes : fromData),
    base.templates,
    base.year,
    base.month,
  );

  // Everything saved in one is offered only to someone who has declared no
  // savings account: beside them it would count the same euros twice.
  const offerable = ENVELOPE_ORDER.filter(
    (id) => id !== "savings" || base.savingsAccounts.length === 0,
  );

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <Intro />

      <Stagger
        className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5"
        stagger={0.06}
      >
        <StaggerItem className="md:col-span-2">
          <YearAheadCard
            projection={base.projection}
            hasTemplates={base.hasTemplates}
            extra={extra}
            onExtraChange={setExtra}
            milestoneLine={
              extra > 0 ? (
                <Suspense fallback={null}>
                  <WhatIfMilestone base={base} wealth={wealth} extra={extra} />
                </Suspense>
              ) : null
            }
          />
        </StaggerItem>

        <StaggerItem>
          <Suspense fallback={<CardPlaceholder rows={3} />}>
            <Milestones base={base} wealth={wealth} />
          </Suspense>
        </StaggerItem>

        <StaggerItem>
          <CushionCard cushion={buildCushion(runway.months)} />
        </StaggerItem>

        {base.properties && base.properties.length > 0 ? (
          <StaggerItem className="md:col-span-2">
            <Suspense fallback={<CardPlaceholder rows={3} />}>
              <NetWorth
                base={base}
                wealth={wealth}
                properties={base.properties}
              />
            </Suspense>
          </StaggerItem>
        ) : null}

        <StaggerItem className="md:col-span-2">
          <Suspense fallback={<CardPlaceholder rows={5} />}>
            <LongView
              base={base}
              wealth={wealth}
              draft={draft}
              offerable={offerable}
            />
          </Suspense>
        </StaggerItem>

        <StaggerItem>
          <RunCard
            closes={base.closes}
            monthlyCommitted={runway.monthlyCommitted}
          />
        </StaggerItem>

        <StaggerItem>
          <MonthsCard history={base.closes.history} />
        </StaggerItem>

        <StaggerItem className="md:col-span-2">
          <CloseDetails base={base} />
        </StaggerItem>

        {/* Under the run, because a connected bank is what makes the month's
            bilan do itself. */}
        {bankInvite ? (
          <StaggerItem className="md:col-span-2">
            <ConnectBankInvite surface="plan" />
          </StaggerItem>
        ) : null}
      </Stagger>
    </div>
  );
}

function isSavingsEnvelope(id: EnvelopeId): boolean {
  return id === "savings" || SAVINGS_KINDS.includes(id as SavingsAccountKind);
}

function Intro() {
  const t = useT();
  return (
    <p className="text-sm text-muted-foreground">{t("futurePlan.intro")}</p>
  );
}

/* ---------------------------------------------- what needs market prices */

/**
 * The accounts from the user's own figures, and their monthly gross value
 * over the longest horizon the page offers.
 *
 * The milestones and the "what if" read these and never the long view's
 * edits: a milestone is about money that exists, and a reader trying out a
 * 12% return should not be told they have passed one. Forty years whatever
 * the horizon slider says, so moving it never moves a milestone.
 */
function useFromData(base: PlanBase, wealth: Promise<PlanWealth | null>) {
  const resolved = use(wealth);
  return useMemo(() => {
    const envelopes = planEnvelopes(base, resolved);
    return {
      envelopes,
      current: wealthToday(envelopes),
      series: projectEnvelopes({
        envelopes,
        years: HORIZON_MAX,
        inflation: DEFAULT_INFLATION,
        withdrawalRate: DEFAULT_WITHDRAWAL,
      }).monthly,
    };
  }, [base, resolved]);
}

function Milestones({
  base,
  wealth,
}: {
  base: PlanBase;
  wealth: Promise<PlanWealth | null>;
}) {
  const { current, series } = useFromData(base, wealth);
  const milestones = useMemo(
    () => buildMilestones(current, series),
    [current, series],
  );
  const topReached = milestones.reduce<number | null>(
    (top, milestone) =>
      milestone.reached ? Math.max(top ?? 0, milestone.amount) : top,
    null,
  );

  // Celebrated once, on whichever device sees it first: when a tier was
  // crossed since the last visit, on the user's real figures. A first visit
  // only records where they stand. The figure the page loaded with is held,
  // so writing the new one does not take the badge away again.
  const [seen] = useState(base.milestoneSeen);
  const isNew = seen !== null && topReached !== null && topReached > seen;

  useEffect(() => {
    if (topReached !== null && (seen === null || topReached > seen)) {
      void markMilestoneSeen(topReached);
    }
  }, [seen, topReached]);

  return (
    <MilestonesCard
      milestones={milestones}
      current={current}
      horizonYears={HORIZON_MAX}
      year={base.year}
      month={base.month}
      isNew={isNew}
    />
  );
}

/** Net worth today, the homes beside what the milestones count. */
function NetWorth({
  base,
  wealth,
  properties,
}: {
  base: PlanBase;
  wealth: Promise<PlanWealth | null>;
  properties: NonNullable<PlanBase["properties"]>;
}) {
  const { current } = useFromData(base, wealth);
  return (
    <NetWorthCard liquid={current} properties={properties} today={base.today} />
  );
}

/** What the "Et si…" extra does to the next milestone it moves, if any. */
function WhatIfMilestone({
  base,
  wealth,
  extra,
}: {
  base: PlanBase;
  wealth: Promise<PlanWealth | null>;
  extra: number;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { current, series } = useFromData(base, wealth);

  const line = useMemo(() => {
    for (const milestone of buildMilestones(current, series)) {
      if (milestone.reached) {
        continue;
      }
      const before = monthsUntil(milestone.amount, series);
      const after = monthsUntil(milestone.amount, series, extra);
      if (after === null) {
        continue;
      }
      if (before === null) {
        return t("futurePlan.whatIfNowReached", {
          milestone: format(milestone.amount),
          month: monthLabelAhead(base.year, base.month, after, locale),
        });
      }
      if (after < before) {
        return t("futurePlan.whatIfSooner", {
          milestone: format(milestone.amount),
          count: before - after,
        });
      }
    }
    return null;
  }, [current, series, extra, t, format, locale, base.year, base.month]);

  if (!line) {
    return null;
  }
  return (
    <p className="privacy-sensitive mt-1 flex items-center gap-1.5 text-sm text-primary-ink">
      <Sparkle size={ICON.sm} weight="fill" aria-hidden />
      {line}
    </p>
  );
}

function LongView({
  base,
  wealth,
  draft,
  offerable,
}: {
  base: PlanBase;
  wealth: Promise<PlanWealth | null>;
  draft: LongViewDraft | null;
  offerable: readonly EnvelopeId[];
}) {
  const { envelopes } = useFromData(base, wealth);
  const view = useMemo<LongViewDraft>(
    () =>
      draft ?? {
        years: DEFAULT_YEARS,
        inflation: DEFAULT_INFLATION,
        withdrawalRate: DEFAULT_WITHDRAWAL,
        envelopes,
      },
    [draft, envelopes],
  );
  const projection = useMemo(() => projectEnvelopes(view), [view]);

  const card = (
    <LongViewCard
      view={view}
      projection={projection}
      edited={draft !== null}
      offerable={offerable}
      onChange={(next) => saveLongViewDraft(base.userId, next)}
      onReset={() => clearLongViewDraft(base.userId)}
    />
  );
  if (!base.properties || base.properties.length === 0) {
    return card;
  }
  // The homes follow the long view's horizon and inflation, so moving the
  // slider moves both cards.
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {card}
      <PropertyLongViewCard
        properties={base.properties}
        today={base.today}
        years={view.years}
        inflation={view.inflation}
        liquidNet={projection.netValue}
      />
    </div>
  );
}

/** A card's shape while what it needs is on its way. */
function CardPlaceholder({ rows }: { rows: number }) {
  return (
    <div
      aria-hidden
      className={cn(
        GLASS_CARD,
        "flex h-full flex-col gap-3 rounded-card p-card",
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

/* ------------------------------------------------- the close's settings */

/**
 * The close's own settings — the allowance and the reading day — and the
 * month-by-month detail, folded away under the months: they are set once and
 * looked at rarely, and the page above is what it is for.
 */
function CloseDetails({ base }: { base: PlanBase }) {
  const t = useT();
  return (
    <details className={cn(GLASS_CARD, "group rounded-card")}>
      <summary
        className={cn(
          "flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-card",
          "text-sm font-medium text-muted-foreground transition-colors duration-hover hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <GearSix size={ICON.sm} weight="fill" />
          </span>
          <span className="group-open:hidden">{t("planWeb.closeDetails")}</span>
          <span className="hidden group-open:inline">
            {t("planWeb.closeDetailsHide")}
          </span>
        </span>
        <CaretDown
          size={ICON.sm}
          aria-hidden
          className="transition-transform duration-hover group-open:rotate-180"
        />
      </summary>
      <div className="px-1.5 pb-1.5">
        <MonthCloseHistory
          history={base.closes.history}
          summary={base.closes.summary}
          unrecordedCap={base.closes.settings.unrecordedCap}
          closeDay={base.closes.settings.closeDay}
        />
      </div>
    </details>
  );
}
