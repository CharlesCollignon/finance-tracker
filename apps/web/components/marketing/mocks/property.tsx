"use client";

import { OwnershipBar } from "@/components/finance/property/ProgressBars";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  ACTIVE_NAV,
  MOBILE_HEIGHT,
  MOBILE_WIDTH,
  MobileShell,
  MockCard,
  MockViewport,
  type Variant,
  WEB_HEIGHT,
  WEB_WIDTH,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/** Immobilier, as a landing mock (`./frame.tsx`). */

/* ---------------------------------------------------------------- property */

/** The studio's own card: its name, its net value, the bar of what is yours. */
function PropertyCard({ compact = false }: { compact?: boolean }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { property } = sample;
  const net = property.value - property.owed;
  return (
    <MockCard
      innerClassName={cn("flex flex-col gap-5", compact ? "p-4" : "p-6")}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-head text-lg">{property.name}</p>
        <p className="text-xs text-muted-foreground">{property.kindLine}</p>
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          {t("property.netValue")}
        </p>
        <p
          className={cn(
            "font-serif font-semibold tabular-nums",
            compact ? "text-4xl" : "text-5xl",
          )}
        >
          {euro(net)}
        </p>
      </div>
      <OwnershipBar
        ownership={{
          yours: net,
          owed: property.owed,
          share: net / property.value,
        }}
        detailed
      />
      {compact ? null : (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("property.estimatedValue")}
            </p>
            <p className="font-medium tabular-nums">{euro(property.value)}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {t("property.valueRange", {
                low: euro(property.low),
                high: euro(property.high),
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("property.owed")}
            </p>
            <p className="font-medium tabular-nums">{euro(property.owed)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("property.loansMonthly")}
            </p>
            <p className="font-medium tabular-nums">{euro(property.monthly)}</p>
          </div>
        </div>
      )}
    </MockCard>
  );
}

export function PropertyMock({ variant = "web" }: { variant?: Variant }) {
  if (variant === "mobile") {
    return (
      <MockViewport width={MOBILE_WIDTH} height={MOBILE_HEIGHT}>
        <MobileShell active={ACTIVE_NAV.property}>
          <PropertyCard compact />
        </MobileShell>
      </MockViewport>
    );
  }
  return (
    <MockViewport width={WEB_WIDTH} height={WEB_HEIGHT}>
      <WebShell active={ACTIVE_NAV.property}>
        <div className="mx-auto w-full max-w-2xl">
          <PropertyCard />
        </div>
      </WebShell>
    </MockViewport>
  );
}
