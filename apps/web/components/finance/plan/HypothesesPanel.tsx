"use client";

import { useMemo, useState } from "react";
import { CaretDown, SlidersHorizontal } from "@phosphor-icons/react";
import { formatPercentLabel } from "@finance/core/constants";
import {
  ENVELOPE_NAME_KEYS,
  ENVELOPE_SHORT_KEYS,
  ENVELOPE_TAX_KEYS,
  type Envelope,
} from "@finance/core/future-plan";
import type { WalletMix } from "@finance/core/history/mix";
import { historyReturnFor } from "@finance/core/history/plan-accounts";
import type {
  EnvelopeEdit,
  HypothesesEdits,
} from "@finance/core/history/plan-settings";
import { HISTORY_END, HISTORY_START } from "@finance/core/history/series";
import { HISTORY_SOURCES } from "@finance/core/history/sources";
import type { InvestmentWalletId } from "@finance/core/investments";
import { DEFAULT_PROPERTY_GROWTH } from "@finance/core/property-future";
import { isSavingsKind } from "@finance/core/savings-accounts";
import type { PropertyRead } from "@finance/data/properties";
import { useToast } from "@/components/layout/ToastProvider";
import { setGrowth } from "@/lib/actions/property";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import { NumberField } from "./plan-controls";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * « Hypothèses », folded: each account's figures as the trajectory reads
 * them, every one of them the reader's to change. The return starts at what
 * the account's history returned; a change moves that whole history, its
 * falls kept. Below, where the history comes from and on what terms.
 *
 * The milestones and « Face à l'histoire » never read these: they are about
 * money that exists and markets as they were. A home's yearly growth is the
 * one figure kept for the account, as its own page keeps it.
 */
export function HypothesesPanel({
  envelopes,
  edited,
  edits,
  wallets,
  onEdits,
  properties,
}: {
  /** The reader's own figures. */
  envelopes: readonly Envelope[];
  /** The same with the edits laid over. */
  edited: readonly Envelope[];
  edits: HypothesesEdits;
  wallets: Partial<Record<InvestmentWalletId, WalletMix>>;
  onEdits: (edits: HypothesesEdits) => void;
  /** The homes, whose yearly growth « Avec vos biens » reads. */
  properties: readonly PropertyRead[] | null;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const history = useMemo(
    () =>
      new Map(
        envelopes.map((envelope) => [
          envelope.id,
          historyReturnFor(envelope, wallets),
        ]),
      ),
    [envelopes, wallets],
  );

  function change(envelope: Envelope, patch: EnvelopeEdit) {
    onEdits({
      ...edits,
      [envelope.id]: { ...edits[envelope.id], ...patch },
    });
  }

  return (
    <section className={cn(GLASS_CARD, "rounded-card")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-card px-card text-left text-sm font-medium text-muted-foreground transition-colors duration-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <SlidersHorizontal size={ICON.sm} weight="bold" />
          </span>
          {open
            ? t("trajectory.hypothesesHide")
            : t("trajectory.hypothesesTitle")}
        </span>
        <CaretDown
          size={ICON.sm}
          aria-hidden
          className={cn(
            "transition-transform duration-hover",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-4 px-card pb-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-prose text-sm text-muted-foreground">
              {t("trajectory.hypothesesLead")}
            </p>
            {Object.keys(edits).length > 0 ? (
              <button
                type="button"
                onClick={() => onEdits({})}
                className="text-sm font-medium text-primary-ink underline-offset-4 hover:underline"
              >
                {t("futurePlan.accountsReset")}
              </button>
            ) : null}
          </div>

          <ul className="grid gap-3 lg:grid-cols-2">
            {edited.map((envelope) => {
              const base = history.get(envelope.id) ?? null;
              const typed = edits[envelope.id]?.annualReturn;
              const isPel = envelope.id === "pel";
              const returnValue =
                typed ?? (isPel ? envelope.annualReturn : base);
              const name = t(ENVELOPE_SHORT_KEYS[envelope.id]);
              const spelled = t(ENVELOPE_NAME_KEYS[envelope.id]);
              return (
                <li
                  key={envelope.id}
                  className="rounded-control border border-border p-3"
                >
                  <p className="text-sm font-medium">{name}</p>
                  {spelled !== name ? (
                    <p className="text-xs text-muted-foreground">{spelled}</p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <NumberField
                      label={t("futurePlan.fieldInitial")}
                      value={envelope.initial}
                      onChange={(initial) => change(envelope, { initial })}
                      min={0}
                      sensitive
                    />
                    <NumberField
                      label={t("futurePlan.fieldMonthly")}
                      value={envelope.monthly}
                      onChange={(monthly) => change(envelope, { monthly })}
                      min={0}
                      sensitive
                    />
                    {returnValue === null ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {t("futurePlan.fieldReturn")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("trajectory.returnNone")}
                        </span>
                      </div>
                    ) : (
                      <NumberField
                        label={t("futurePlan.fieldReturn")}
                        value={round2(returnValue * 100)}
                        onChange={(value) =>
                          change(envelope, { annualReturn: value / 100 })
                        }
                        min={-20}
                        max={30}
                        suffix="%"
                        hint={
                          isPel
                            ? t("trajectory.returnContract")
                            : base !== null
                              ? t("trajectory.returnFromHistory", {
                                  from: HISTORY_START.slice(0, 4),
                                  to: HISTORY_END.slice(0, 4),
                                  rate: formatPercentLabel(base * 100, locale),
                                })
                              : undefined
                        }
                      />
                    )}
                    {envelope.id === "savings" ||
                    isSavingsKind(envelope.id) ? null : (
                      <NumberField
                        label={t("futurePlan.fieldFees")}
                        value={round2((envelope.fees ?? 0) * 100)}
                        onChange={(value) =>
                          change(envelope, { fees: value / 100 })
                        }
                        min={0}
                        max={5}
                        suffix="%"
                      />
                    )}
                    <NumberField
                      label={t("futurePlan.fieldTax")}
                      value={round2(envelope.taxOnGains * 100)}
                      onChange={(value) =>
                        change(envelope, { taxOnGains: value / 100 })
                      }
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
            })}
          </ul>

          {properties && properties.length > 0 ? (
            <HomesGrowth properties={properties} />
          ) : null}

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>{t("trajectory.realTermsNote")}</p>
            <p>{t("trajectory.reconstructedNote")}</p>
            <p>{t("trajectory.pastNotPromise")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {t("trajectory.sourcesTitle")}
            </p>
            <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {HISTORY_SOURCES.map((source) => (
                <li key={source.title}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {source.publisher}
                  </a>
                  {" — "}
                  {source.title}
                  {" · "}
                  {source.terms}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Each home's yearly growth, the one figure in « Hypothèses » kept for the
 * account: held here while it is typed, saved when the field is left.
 */
function HomesGrowth({ properties }: { properties: readonly PropertyRead[] }) {
  const t = useT();
  const { toast } = useToast();
  const saved = (read: PropertyRead) =>
    read.property.yearly_growth === null
      ? DEFAULT_PROPERTY_GROWTH
      : Number(read.property.yearly_growth);
  const [growth, setGrowthFor] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      properties.map((read) => [read.property.id, saved(read)]),
    ),
  );
  const [kept, setKept] = useState(growth);

  function keep(propertyId: string) {
    const rate = growth[propertyId];
    if (rate === undefined || rate === kept[propertyId]) {
      return;
    }
    setKept((current) => ({ ...current, [propertyId]: rate }));
    void setGrowth(propertyId, rate).then((result) => {
      if (!result.success) {
        toast(result.error, "error");
      }
    });
  }

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {properties.map((read) => (
        <li
          key={read.property.id}
          className="rounded-control border border-border p-3"
          onBlur={() => keep(read.property.id)}
        >
          <p className="mb-3 text-sm font-medium">{read.property.name}</p>
          <NumberField
            label={t("property.longViewGrowth")}
            value={
              Math.round((growth[read.property.id] ?? saved(read)) * 1000) / 10
            }
            min={-20}
            max={20}
            suffix="%"
            onChange={(percent) =>
              setGrowthFor((current) => ({
                ...current,
                [read.property.id]: percent / 100,
              }))
            }
          />
        </li>
      ))}
    </ul>
  );
}
