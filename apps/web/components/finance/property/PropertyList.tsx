"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react";
import { formatPercentLabel } from "@finance/core/constants";
import { valueSourceLine } from "@finance/core/property";
import { ownership } from "@finance/core/property-progress";
import { StatHero } from "@/components/finance/StatHero";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import type { PropertiesView, PropertySummary } from "@/lib/queries/properties";
import { useFormatCurrency } from "@/lib/use-currency";
import { AddPropertySheet } from "./AddPropertySheet";
import { OwnershipBar } from "./ProgressBars";
import { PROPERTY_KIND_KEYS, PROPERTY_USAGE_KEYS } from "./property-labels";

/**
 * The Immobilier tab: what the user's properties are worth to them once
 * the loans are counted, one card each, and the way to add one.
 */
export function PropertyList({ view }: { view: PropertiesView }) {
  const t = useT();
  const format = useFormatCurrency();
  const [adding, setAdding] = useState(false);
  const addButton = (
    <Button type="button" onClick={() => setAdding(true)}>
      <Plus size={ICON.sm} aria-hidden className="mr-1.5" />
      {t("property.add")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      {view.properties.length === 0 ? (
        <EmptyState
          title={t("property.emptyTitle")}
          description={t("property.emptyBody")}
        >
          {addButton}
        </EmptyState>
      ) : (
        <>
          <StatHero
            label={t("property.totalLabel")}
            amount={format(view.total.netValue)}
            subtitle={t("property.worthLine", {
              value: format(view.total.value),
              owed: format(view.total.owed),
            })}
          />
          <ul className="grid gap-4 md:grid-cols-2">
            {view.properties.map((property) => (
              <li key={property.id}>
                <Link
                  href={`/property/${property.id}`}
                  className="block rounded-shell transition-transform duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
                >
                  <PropertyCard property={property} />
                </Link>
              </li>
            ))}
          </ul>
          <div>{addButton}</div>
        </>
      )}
      <AddPropertySheet open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function PropertyCard({ property }: { property: PropertySummary }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { position } = property;
  const source = position.estimate.source;

  return (
    <Card.Bezel
      className="w-full"
      innerClassName="flex w-full min-w-0 flex-col gap-4 p-5 md:p-6"
    >
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 truncate font-head text-lg">{property.name}</h2>
        <p className="text-xs text-muted-foreground">
          {[
            t(PROPERTY_KIND_KEYS[property.kind]),
            t(PROPERTY_USAGE_KEYS[property.usage]),
            property.postcode,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t("property.netValue")}
        </p>
        <p className="privacy-amount font-serif text-3xl font-semibold tabular-nums">
          {format(position.netValue)}
        </p>
        <p className="privacy-sensitive text-sm text-muted-foreground tabular-nums">
          {t("property.worthLine", {
            value: format(position.value),
            owed: format(position.owed),
          })}
        </p>
      </div>

      <OwnershipBar ownership={ownership(position)} />

      <p className="text-xs text-muted-foreground">
        {[
          valueSourceLine(source, locale, "short"),
          property.ownershipShare < 1
            ? t("property.shareLine", {
                share: formatPercentLabel(
                  property.ownershipShare * 100,
                  locale,
                ),
              })
            : null,
          property.loanCount > 0
            ? t("property.loans", { count: property.loanCount })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </Card.Bezel>
  );
}
