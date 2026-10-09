"use client";

import type { ReactNode } from "react";
import { ArrowLeft, PencilSimple } from "@phosphor-icons/react";
import { formatPercentLabel } from "@finance/core/constants";
import { valueSourceLine } from "@finance/core/property";
import {
  PROPERTY_KIND_KEYS,
  PROPERTY_USAGE_KEYS,
} from "@/components/finance/property/property-labels";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  ACTIVE_NAV,
  MobileShell,
  MockCard,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/**
 * Immobilier, as a landing mock (`./frame.tsx`): the sample's studio on its
 * own page, as `PropertyDetail` draws it — what it is, its net value, the
 * bar of the part that is yours and the bank's, then its figures: the
 * estimate and the sales it rests on, the price a square metre around it,
 * what is still owed, what it cost, the gain and what has been repaid.
 * On the phone it is a screen pushed over the tabs, named after the studio.
 */

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function PropertyCard({ phone }: { phone: boolean }) {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { property } = landingSampleFor(locale);
  const net = property.value - property.owed;
  const share = net / property.value;
  const percent = (value: number) =>
    formatPercentLabel(Math.round(value * 1000) / 10, locale);
  const source = valueSourceLine(
    {
      kind: "market",
      scope: "radius",
      sales: property.market.sales,
      periodFrom: property.market.periodFrom,
      periodTo: property.market.periodTo,
      quarter: property.market.quarter,
    },
    locale,
  );
  const value = (text: string) => (
    <p className="text-sm font-medium tabular-nums">{text}</p>
  );

  return (
    <MockCard innerClassName={cn("flex flex-col gap-6", phone ? "p-4" : "p-6")}>
      <div className="flex flex-col items-center gap-1 text-center">
        {phone ? null : <h2 className="font-head text-xl">{property.name}</h2>}
        <p className="text-xs text-muted-foreground">
          {[
            t(PROPERTY_KIND_KEYS.apartment),
            t(PROPERTY_USAGE_KEYS.rental_furnished),
            "24 m²",
            property.postcode,
          ].join(" · ")}
        </p>
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          {t("property.netValue")}
        </p>
        <p className="font-serif text-4xl font-semibold tabular-nums">
          {euro(net)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="relative h-2 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-foreground/70"
            style={{ width: `${share * 100}%` }}
          />
        </div>
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-medium">
            {t("property.ownershipYours", { share: percent(share) })}
          </span>
          <span className="text-muted-foreground">
            {t("property.ownershipBank", { share: percent(1 - share) })}
          </span>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {t("property.ownershipAmounts", {
            yours: euro(net),
            owed: euro(property.owed),
          })}
        </p>
      </div>

      <dl className={cn("grid gap-4", phone ? "grid-cols-1" : "grid-cols-2")}>
        <Fact label={t("property.estimatedValue")}>
          {value(euro(property.value))}
          <p className="text-xs tabular-nums">
            {t("property.valueRange", {
              low: euro(property.low),
              high: euro(property.high),
            })}
          </p>
          <p className="text-xs text-muted-foreground">{source}</p>
        </Fact>
        <Fact label={t("property.pricePerM2")}>
          {value(
            t("property.pricePerM2Line", {
              median: euro(property.market.medianM2),
              low: euro(property.market.lowM2),
              high: euro(property.market.highM2),
            }),
          )}
        </Fact>
        <Fact label={t("property.owed")}>{value(euro(property.owed))}</Fact>
        <Fact label={t("property.cost")}>{value(euro(property.cost))}</Fact>
        <Fact label={t("property.gain")}>
          {value(euro(property.value - property.cost))}
        </Fact>
        <Fact label={t("property.principalRepaid")}>
          {value(euro(property.borrowed - property.owed))}
        </Fact>
      </dl>

      {phone ? null : (
        <div className="border-t border-border pt-4">
          <span className="inline-flex items-center rounded-control border border-border px-3 py-1.5 text-sm font-medium">
            <PencilSimple size={14} className="mr-1.5" />
            {t("property.edit")}
          </span>
        </div>
      )}
    </MockCard>
  );
}

export function PropertyMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();
  const { property } = landingSampleFor(useLocale());

  if (variant === "mobile") {
    return (
      <MobileShell active={ACTIVE_NAV.property} title={property.name} back>
        <PropertyCard phone />
      </MobileShell>
    );
  }

  return (
    <WebShell active={ACTIVE_NAV.property}>
      <span className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground">
        <ArrowLeft size={14} />
        {t("property.backToList")}
      </span>
      <PropertyCard phone={false} />
    </WebShell>
  );
}
