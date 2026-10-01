"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowCounterClockwise,
  ChartLineUp,
  Minus,
  Plus,
  X,
} from "@phosphor-icons/react";
import {
  breakdownAccounts,
  breakdownParts,
  ENVELOPE_NAME_KEYS,
  ENVELOPE_ORDER,
  ENVELOPE_PRESETS,
  ENVELOPE_SHORT_KEYS,
  ENVELOPE_TAX_KEYS,
  type Envelope,
  type EnvelopeId,
  type EnvelopeProjection,
  type EnvelopeShare,
} from "@finance/core/future-plan";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { FIGURE, MICRO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { GROWTH_SERIES, GrowthChart } from "./GrowthChart";
import type { LongViewDraft } from "./plan-storage";
import { NumberField, PlanCard, Slider } from "./plan-controls";

const HORIZON_MIN = 1;
export const HORIZON_MAX = 40;

/**
 * The accounts' colours in the breakdown, by their place among the accounts
 * named (`breakdownAccounts`): chart tokens and never the accent, which on this page means a milestone. Beyond
 * four accounts the rest are one muted "Others".
 */
const SHARE_COLORS = [
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-5)",
] as const;
const OTHERS_COLOR =
  "color-mix(in oklab, var(--muted-foreground) 45%, transparent)";

interface LongViewCardProps {
  view: LongViewDraft;
  projection: EnvelopeProjection;
  /** The reader has changed something, so there is something to go back from. */
  edited: boolean;
  /** The accounts the reader may add back, in the usual order. */
  offerable: readonly EnvelopeId[];
  onChange: (next: LongViewDraft) => void;
  onReset: () => void;
}

/**
 * The long view: what the savings and investments could become in a number
 * of years, after French tax, in today's euros, and as an income.
 *
 * A calculator, and says so. It opens on the user's own figures — what each
 * account holds today and what the recurring entries put into it — with a
 * return and a tax rate per account that are the 2026 French rules
 * simplified to one rate, each with its note in words. Every one of those is
 * the reader's to change, and the change stays in this browser until they
 * go back to their figures. The result answers each edit at once.
 */
export function LongViewCard({
  view,
  projection,
  edited,
  offerable,
  onChange,
  onReset,
}: LongViewCardProps) {
  const t = useT();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));
  // The year the chart is being read at, so the breakdown follows it.
  const [scrubbed, setScrubbed] = useState<number | null>(null);
  const shares =
    scrubbed !== null && projection.years[scrubbed]
      ? projection.years[scrubbed].accounts
      : projection.accounts;

  const yearLabel = (year: number) =>
    year === 0
      ? t("futurePlan.today")
      : t("futurePlan.inYears", { count: year });

  const setEnvelope = (id: EnvelopeId, patch: Partial<Envelope>) =>
    onChange({
      ...view,
      envelopes: view.envelopes.map((envelope) =>
        envelope.id === id ? { ...envelope, ...patch } : envelope,
      ),
    });

  const missing = offerable.filter(
    (id) => !view.envelopes.some((envelope) => envelope.id === id),
  );

  const stats = [
    { label: t("futurePlan.statFuture"), value: projection.futureValue },
    { label: t("futurePlan.statGains"), value: projection.gains },
    { label: t("futurePlan.statTaxes"), value: projection.taxes },
    { label: t("futurePlan.statNet"), value: projection.netValue },
  ];

  return (
    <PlanCard
      icon={<ChartLineUp size={ICON.sm} weight="bold" />}
      title={t("futurePlan.longTitle", { count: view.years })}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
        {/* The inputs: left on a wide screen, under the result on a phone,
            where the answer is what makes the questions worth asking. */}
        <div className="flex min-w-0 flex-col gap-5 lg:order-first">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {t("futurePlan.horizon")}
              </span>
              <span className="text-sm font-medium tabular-nums">
                {t("futurePlan.years", { count: view.years })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StepButton
                label={t("planWeb.horizonLess")}
                disabled={view.years <= HORIZON_MIN}
                onClick={() => onChange({ ...view, years: view.years - 1 })}
              >
                <Minus size={ICON.sm} weight="bold" />
              </StepButton>
              <Slider
                value={view.years}
                min={HORIZON_MIN}
                max={HORIZON_MAX}
                step={1}
                onChange={(years) => onChange({ ...view, years })}
                label={t("futurePlan.horizon")}
                valueText={t("futurePlan.years", { count: view.years })}
                className="min-w-0 flex-1"
              />
              <StepButton
                label={t("planWeb.horizonMore")}
                disabled={view.years >= HORIZON_MAX}
                onClick={() => onChange({ ...view, years: view.years + 1 })}
              >
                <Plus size={ICON.sm} weight="bold" />
              </StepButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label={t("futurePlan.inflation")}
              value={round2(view.inflation * 100)}
              onChange={(value) =>
                onChange({ ...view, inflation: value / 100 })
              }
              min={0}
              max={20}
              suffix="%"
              hint={t("futurePlan.inflationHint")}
            />
            <NumberField
              label={t("futurePlan.withdrawalRate")}
              value={round2(view.withdrawalRate * 100)}
              onChange={(value) =>
                onChange({ ...view, withdrawalRate: value / 100 })
              }
              min={0}
              max={20}
              suffix="%"
              hint={t("futurePlan.withdrawalHint")}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="font-head text-base">
                {t("futurePlan.accountsTitle")}
              </h3>
              {edited ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8"
                >
                  <ArrowCounterClockwise size={ICON.sm} aria-hidden />
                  {t("futurePlan.accountsReset")}
                </button>
              ) : null}
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              {t("futurePlan.accountsFromData")}
            </p>

            <ul className="flex flex-col gap-3">
              {view.envelopes.map((envelope) => (
                <EnvelopeRow
                  key={envelope.id}
                  envelope={envelope}
                  onChange={(patch) => setEnvelope(envelope.id, patch)}
                  onRemove={() =>
                    onChange({
                      ...view,
                      envelopes: view.envelopes.filter(
                        (other) => other.id !== envelope.id,
                      ),
                    })
                  }
                />
              ))}
            </ul>

            {missing.length > 0 ? (
              <div
                role="group"
                aria-label={t("planWeb.accountPick")}
                className="flex flex-col gap-2"
              >
                <p className="text-xs text-muted-foreground">
                  {t("futurePlan.accountAdd")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {missing.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...view,
                          envelopes: ENVELOPE_ORDER.flatMap((orderId) => {
                            if (orderId === id) {
                              return [
                                {
                                  id,
                                  initial: 0,
                                  monthly: 0,
                                  annualReturn:
                                    ENVELOPE_PRESETS[id].annualReturn,
                                  taxOnGains: ENVELOPE_PRESETS[id].taxOnGains,
                                },
                              ];
                            }
                            return view.envelopes.filter(
                              (envelope) => envelope.id === orderId,
                            );
                          }),
                        })
                      }
                      className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm transition-colors duration-hover hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
                    >
                      <Plus size={ICON.xs} weight="bold" aria-hidden />
                      {t(ENVELOPE_SHORT_KEYS[id])}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* The answer. */}
        <div className="order-first flex min-w-0 flex-col gap-4 lg:order-none">
          <div>
            <AnimatedAmount
              value={projection.netValue}
              format={money}
              className={cn(FIGURE, "block")}
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {t("futurePlan.longNet")}
            </p>
            <AccountBreakdown
              shares={shares}
              horizon={projection.accounts}
              format={money}
            />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <p className="privacy-sensitive">
              {t("futurePlan.longReal", {
                amount: money(projection.realNetValue),
              })}
            </p>
            <p className="privacy-sensitive font-medium text-primary-ink">
              {t("futurePlan.longIncome", {
                amount: money(projection.monthlyIncome),
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("futurePlan.longIncomeHint")}
            </p>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {GROWTH_SERIES.map((series) => (
              <li key={series.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn("size-2.5 rounded-sm", series.swatch)}
                />
                {series.key === "initial"
                  ? t("futurePlan.legendInitial")
                  : series.key === "contributions"
                    ? t("futurePlan.legendContributions")
                    : t("futurePlan.legendGains")}
              </li>
            ))}
          </ul>

          <GrowthChart
            years={projection.years}
            format={money}
            yearLabel={yearLabel}
            onActiveChange={setScrubbed}
          />

          <dl className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-control border border-border p-3"
              >
                <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                <dd className="privacy-amount mt-1 font-serif text-lg font-semibold tabular-nums">
                  {money(stat.value)}
                </dd>
              </div>
            ))}
          </dl>

          <p className={cn(MICRO, "text-muted-foreground")}>
            {t("futurePlan.estimate")} {t("futurePlan.taxSource")}
          </p>
        </div>
      </div>
    </PlanCard>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Which account the future money sits in: a thin bar of each one's share and
 * one muted line naming them — at the horizon, or at the year the chart is
 * being read. Small on purpose; the figure above it is the answer, this only
 * says what it is made of.
 *
 * The accounts named, and so their colours, are decided at the horizon and
 * held while the chart is read year by year: a colour follows its account,
 * never its rank in the year under the pointer.
 */
function AccountBreakdown({
  shares,
  horizon,
  format,
}: {
  /** The year being read. */
  shares: readonly EnvelopeShare[];
  /** The horizon, which picks the accounts named and their colours. */
  horizon: readonly EnvelopeShare[];
  format: (value: number) => string;
}) {
  const t = useT();
  const named = breakdownAccounts(horizon, SHARE_COLORS.length);
  const parts = breakdownParts(shares, named).map((part) => ({
    key: part.id,
    label:
      part.id === "others"
        ? t("planWeb.breakdownOthers")
        : t(ENVELOPE_SHORT_KEYS[part.id]),
    value: part.netValue,
    color: part.slot === null ? OTHERS_COLOR : SHARE_COLORS[part.slot]!,
  }));
  if (parts.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label={t("accounts.breakdown")}
      className="mt-3 flex flex-col gap-1.5"
    >
      {parts.length > 1 ? (
        <div aria-hidden className="flex h-1.5 w-full gap-0.5">
          {parts.map((part) => (
            <span
              key={part.key}
              className="h-full min-w-0.5 rounded-full transition-[flex-grow] duration-300 motion-reduce:transition-none"
              style={{ flexGrow: part.value, backgroundColor: part.color }}
            />
          ))}
        </div>
      ) : null}
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: part.color }}
            />
            {part.label}
            <span className="privacy-amount tabular-nums text-foreground/80">
              {format(part.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EnvelopeRow({
  envelope,
  onChange,
  onRemove,
}: {
  envelope: Envelope;
  onChange: (patch: Partial<Envelope>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const name = t(ENVELOPE_SHORT_KEYS[envelope.id]);
  const spelled = t(ENVELOPE_NAME_KEYS[envelope.id]);
  const fullName = spelled === name ? null : spelled;

  return (
    <li className="rounded-control border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{name}</p>
          {fullName ? (
            <p className="text-xs text-muted-foreground">{fullName}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("futurePlan.accountRemove", { name })}
          className="-m-1 flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-8"
        >
          <X size={ICON.sm} aria-hidden />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <NumberField
          label={t("futurePlan.fieldInitial")}
          value={envelope.initial}
          onChange={(initial) => onChange({ initial })}
          min={0}
          sensitive
        />
        <NumberField
          label={t("futurePlan.fieldMonthly")}
          value={envelope.monthly}
          onChange={(monthly) => onChange({ monthly })}
          min={0}
          sensitive
        />
        <NumberField
          label={t("futurePlan.fieldReturn")}
          value={round2(envelope.annualReturn * 100)}
          onChange={(value) => onChange({ annualReturn: value / 100 })}
          min={-20}
          max={30}
          suffix="%"
        />
        <NumberField
          label={t("futurePlan.fieldTax")}
          value={round2(envelope.taxOnGains * 100)}
          onChange={(value) => onChange({ taxOnGains: value / 100 })}
          min={0}
          max={100}
          suffix="%"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t(ENVELOPE_TAX_KEYS[envelope.id])}
      </p>
    </li>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border transition-colors duration-hover hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 lg:size-9"
    >
      {children}
    </button>
  );
}
