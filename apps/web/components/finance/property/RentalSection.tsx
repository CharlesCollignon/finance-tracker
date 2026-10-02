"use client";

import { formatFullDate, formatPercentLabel } from "@finance/core/constants";
import type { Key } from "@finance/core/i18n/t";
import type { PropertyPosition } from "@finance/core/property";
import type { RentReference } from "@finance/core/rent-reference";
import {
  lettingRule,
  rentalFigures,
  rentPerM2,
  type LettingRule,
} from "@finance/core/rental";
import type { RentScope, RentSeries } from "@finance/core/types/database";
import type { PropertyRead } from "@finance/data/properties";
import { Card } from "@/components/ui/Card";
import { addRentForProperty } from "@/lib/actions/property";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { AmountEditor, Fact } from "./property-controls";

/** A plain card for a few lines of facts, as the recurring list draws. */
const FACTS_CARD =
  "flex flex-col gap-1 rounded-card border border-border bg-card p-4";

const SERIES_KEYS: Record<RentSeries, Key> = {
  app: "property.askingSeriesApp",
  app12: "property.askingSeriesApp12",
  app3: "property.askingSeriesApp3",
  mai: "property.askingSeriesMai",
};

const SCOPE_KEYS: Record<RentScope, Key> = {
  commune: "property.askingScopeCommune",
  epci: "property.askingScopeEpci",
  maille: "property.askingScopeMaille",
};

/**
 * A let property's month — what it leaves or costs, its rent, charges and
 * loans, its yield — what homes like it are advertised for around it, and
 * what its DPE says about letting it. Facts, each with where it comes from.
 */
export function RentalSection({
  detail,
  position,
  today,
}: {
  detail: PropertyRead;
  position: PropertyPosition;
  today: string;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { property, loans, templates } = detail;
  const figures = rentalFigures(loans, templates, position.cost, today);
  const perM2 = rentPerM2(figures.rent, property.living_area);
  const letting = lettingRule(property.energy_class, property.citycode, today);
  const percent = (value: number) => formatPercentLabel(value * 100, locale);

  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-head text-lg">{t("property.rentalTitle")}</h3>

      <Card.Bezel
        className="w-full"
        innerClassName="flex w-full min-w-0 flex-col gap-5 p-5 md:p-6"
      >
        {figures.rent > 0 ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                {figures.cashFlow >= 0
                  ? t("property.cashFlowLeaves")
                  : t("property.cashFlowCosts")}
              </p>
              <p className="privacy-amount font-serif text-3xl font-semibold tabular-nums">
                {format(Math.abs(figures.cashFlow))}
              </p>
            </div>
            <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Fact label={t("property.rentMonthly")}>
                <p className="privacy-sensitive text-sm font-medium tabular-nums">
                  {t("property.perMonth", { amount: format(figures.rent) })}
                </p>
                {perM2 !== null ? (
                  <p className="privacy-sensitive text-xs tabular-nums text-muted-foreground">
                    {t("property.rentPerM2", { amount: format(perM2) })}
                  </p>
                ) : null}
              </Fact>
              <Fact label={t("property.chargesMonthly")}>
                <p className="privacy-sensitive text-sm font-medium tabular-nums">
                  {t("property.perMonth", { amount: format(figures.charges) })}
                </p>
              </Fact>
              {figures.loans > 0 ? (
                <Fact label={t("property.loansMonthly")}>
                  <p className="privacy-sensitive text-sm font-medium tabular-nums">
                    {t("property.perMonth", { amount: format(figures.loans) })}
                  </p>
                </Fact>
              ) : null}
              {figures.grossYield !== null && figures.netYield !== null ? (
                <Fact label={t("property.yieldLabel")}>
                  <p className="privacy-sensitive text-sm font-medium tabular-nums">
                    {t("property.yieldLine", {
                      gross: percent(figures.grossYield),
                      net: percent(figures.netYield),
                    })}
                  </p>
                </Fact>
              ) : null}
            </dl>
            <p className="text-xs text-muted-foreground">
              {t("property.cashFlowNote")} {t("property.yieldNote")}
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {t("property.rentNone")}
            </p>
            <AmountEditor
              label={t("property.rentAdd")}
              hint={t("property.rentAddHint")}
              initial=""
              save={(amount) =>
                addRentForProperty(property.id, amount, property.name)
              }
            />
          </div>
        )}
      </Card.Bezel>

      <AskingRents
        reference={detail.rent}
        area={property.living_area}
        hasAddress={property.citycode !== null}
        furnished={property.usage === "rental_furnished"}
      />

      {letting ? (
        <LettingFacts
          rule={letting}
          energyClass={property.energy_class}
          dateOf={(iso) => formatFullDate(iso, locale)}
        />
      ) : null}
    </section>
  );
}

function AskingRents({
  reference,
  area,
  hasAddress,
  furnished,
}: {
  reference: RentReference | null;
  area: number | null;
  hasAddress: boolean;
  furnished: boolean;
}) {
  const t = useT();
  const format = useFormatCurrency();
  return (
    <div className={FACTS_CARD}>
      <h4 className="text-sm font-medium">{t("property.askingTitle")}</h4>
      {reference ? (
        <>
          <p className="text-sm tabular-nums">
            {t("property.askingLine", {
              median: format(reference.rentM2),
              low: format(reference.lowM2),
              high: format(reference.highM2),
            })}
          </p>
          {area ? (
            <p className="privacy-sensitive text-sm tabular-nums text-muted-foreground">
              {t("property.askingFor", {
                amount: format(Math.round(reference.rentM2 * area)),
                area,
              })}
            </p>
          ) : null}
          {furnished ? (
            <p className="text-xs text-muted-foreground">
              {t("property.askingFurnished")}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("property.askingSource", {
              series: t(SERIES_KEYS[reference.series]),
              scope: t(SCOPE_KEYS[reference.scope]),
              year: reference.edition,
            })}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {hasAddress ? t("property.askingNone") : t("property.askingNoAddress")}
        </p>
      )}
    </div>
  );
}

function LettingFacts({
  rule,
  energyClass,
  dateOf,
}: {
  rule: LettingRule;
  energyClass: string | null;
  dateOf: (iso: string) => string;
}) {
  const t = useT();
  const { status } = rule;
  const energy = energyClass ?? "";
  const line =
    status.kind === "unknown"
      ? t("property.lettingUnknown")
      : status.kind === "open"
        ? t("property.lettingOpen", { energy })
        : status.kind === "closing"
          ? t("property.lettingClosing", { energy, date: dateOf(status.on) })
          : t("property.lettingClosed", {
              energy,
              date: dateOf(status.since),
            });
  return (
    <div className={FACTS_CARD}>
      <h4 className="text-sm font-medium">{t("property.lettingTitle")}</h4>
      <p className="text-sm">{line}</p>
      {rule.rentFrozen ? (
        <p className="text-sm">{t("property.rentFrozen")}</p>
      ) : null}
      {energy === "E" || energy === "F" || energy === "G" ? (
        <p className="text-xs text-muted-foreground">
          {t("property.dpeElectricity")}
        </p>
      ) : null}
      {status.kind !== "unknown" ? (
        <p className="text-xs text-muted-foreground">
          {t("property.lettingSource")}
        </p>
      ) : null}
    </div>
  );
}
