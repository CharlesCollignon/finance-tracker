"use client";

import { useMemo, useState } from "react";
import { House, Scales } from "@phosphor-icons/react";
import { propertyPosition } from "@finance/core/property";
import {
  DEFAULT_PROPERTY_GROWTH,
  loanEndings,
  netWorth,
  projectProperty,
  type LoanEnding,
} from "@finance/core/property-future";
import type { PropertyRead } from "@finance/data/properties";
import { monthAndYear } from "@/components/finance/property/property-labels";
import { useToast } from "@/components/layout/ToastProvider";
import { setGrowth } from "@/lib/actions/property";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { FIGURE, MICRO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { NumberField, PlanCard } from "./plan-controls";

/**
 * The properties on the Plan: where everything stands today, homes and
 * loans counted, and what the homes could leave in the long view's years.
 *
 * Both beside the savings and investments, never in them: a milestone and
 * the long view's monthly income are about money one can spend, and the
 * home one lives in is not.
 */

/** Today's net worth: the savings and investments, the homes, the loans. */
export function NetWorthCard({
  liquid,
  properties,
  today,
}: {
  /** Savings and investments, as the milestones count them. */
  liquid: number;
  properties: readonly PropertyRead[];
  today: string;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));

  const worth = useMemo(
    () =>
      netWorth(
        liquid,
        properties.map(({ property, loans, market }) =>
          propertyPosition(property, loans, today, market),
        ),
      ),
    [liquid, properties, today],
  );
  const endings = useMemo(
    () => endingsAcross(properties, today),
    [properties, today],
  );

  const rows = [
    { label: t("property.netWorthLiquid"), value: money(worth.liquid) },
    { label: t("property.netWorthProperty"), value: money(worth.property) },
    { label: t("property.netWorthOwed"), value: `−${money(worth.owed)}` },
  ];

  return (
    <PlanCard
      icon={<Scales size={ICON.sm} weight="fill" />}
      title={t("property.netWorthTitle")}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <p className={cn(FIGURE, "privacy-amount")}>{money(worth.net)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("property.netWorthLabel")}
            </p>
          </div>
          <dl className="flex flex-col">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
              >
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="privacy-amount tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex min-w-0 flex-col gap-2 text-sm">
          {endings.map((ending) => (
            <p key={`${ending.label}-${ending.endsOn}`} className="privacy-sensitive">
              {t("property.loanEndFrees", {
                label: ending.label,
                date: monthAndYear(ending.endsOn, locale),
                amount: money(ending.monthly),
              })}
            </p>
          ))}
          <p className={cn(MICRO, "text-muted-foreground")}>
            {t("property.netWorthNote")}
          </p>
        </div>
      </div>
    </PlanCard>
  );
}

/**
 * The loans still running across every property, soonest first. With more
 * than one property a loan is named with its home, since two of them can
 * both be « Prêt principal ».
 */
function endingsAcross(
  properties: readonly PropertyRead[],
  today: string,
): LoanEnding[] {
  return properties
    .flatMap(({ property, loans }) =>
      loanEndings(loans, today).map((ending) =>
        properties.length > 1
          ? { ...ending, label: `${property.name} · ${ending.label}` }
          : ending,
      ),
    )
    .sort((a, b) => a.endsOn.localeCompare(b.endsOn));
}

/**
 * The homes at the long view's horizon: grown at each one's own rate, less
 * what its loans would still owe and what a sale would pay in tax — and,
 * with the long view's net, everything together.
 */
export function PropertyLongViewCard({
  properties,
  today,
  years,
  inflation,
  liquidNet,
}: {
  properties: readonly PropertyRead[];
  today: string;
  years: number;
  inflation: number;
  /** The long view's own net at the horizon. */
  liquidNet: number;
}) {
  const t = useT();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));
  const { toast } = useToast();

  // What each field says, held here so the figures follow the typing; kept
  // once the field is left, if it changed.
  const saved = (read: PropertyRead) =>
    read.property.yearly_growth === null
      ? DEFAULT_PROPERTY_GROWTH
      : Number(read.property.yearly_growth);
  const [growth, setGrowthFor] = useState<Record<string, number>>(() =>
    Object.fromEntries(properties.map((read) => [read.property.id, saved(read)])),
  );
  const [kept, setKept] = useState(growth);

  const deflate = (amount: number) => amount / (1 + inflation) ** years;
  const rows = properties.map((read) => {
    const rate = growth[read.property.id] ?? saved(read);
    const projected = projectProperty(read.property, read.loans, read.market, {
      years,
      growth: rate,
      today,
    });
    return { read, rate, end: projected.at(-1)! };
  });
  const total = liquidNet + rows.reduce((sum, row) => sum + row.end.net, 0);

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
    <PlanCard
      icon={<House size={ICON.sm} weight="fill" />}
      title={t("property.longViewTitle", { count: years })}
    >
      <ul className="flex flex-col gap-3">
        {rows.map(({ read, rate, end }) => (
          <li
            key={read.property.id}
            className="flex flex-col gap-3 rounded-control border border-border p-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium">{read.property.name}</p>
              <p className="privacy-amount font-serif text-xl font-semibold tabular-nums">
                {money(end.net)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("property.longViewNet")}
              </p>
              <p className="privacy-sensitive text-sm">
                {t("property.worthLine", {
                  value: money(end.value),
                  owed: money(end.owed),
                })}
              </p>
              <p className="privacy-sensitive text-sm">
                {read.property.usage === "main_home"
                  ? t("property.longViewTaxNone")
                  : t("property.longViewTax", { amount: money(end.tax) })}
              </p>
              <p className="privacy-sensitive text-sm text-muted-foreground">
                {t("futurePlan.longReal", { amount: money(deflate(end.net)) })}
              </p>
            </div>
            <div
              className="sm:w-36 sm:shrink-0"
              onBlur={() => keep(read.property.id)}
            >
              <NumberField
                label={t("property.longViewGrowth")}
                value={Math.round(rate * 1000) / 10}
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
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1 text-sm">
        <p className="privacy-sensitive font-medium text-primary-ink">
          {t("property.longViewTotal", { amount: money(total) })}
        </p>
        <p className="privacy-sensitive text-muted-foreground">
          {t("futurePlan.longReal", { amount: money(deflate(total)) })}
        </p>
      </div>

      <p className={cn(MICRO, "text-muted-foreground")}>
        {t("futurePlan.estimate")} {t("property.longViewNote")}
      </p>
    </PlanCard>
  );
}
