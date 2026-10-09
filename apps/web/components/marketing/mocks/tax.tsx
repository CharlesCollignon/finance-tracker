"use client";

import { landingSampleFor } from "@/components/marketing/landing-sample";
import {
  ACTIVE_NAV,
  MOBILE_HEIGHT,
  MOBILE_WIDTH,
  MockViewport,
  WEB_HEIGHT,
  WEB_WIDTH,
  MobileShell,
  MockCard,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/** « Déclaration de revenus », as a landing mock (`./frame.tsx`). */

function YearChips() {
  const t = useT();
  const { tax } = landingSampleFor(useLocale());
  return (
    <div className="flex self-center rounded-full border border-border p-1 text-sm">
      {[tax.year, tax.year - 1].map((year, index) => (
        <span
          key={year}
          className={cn(
            "rounded-full px-3 py-1",
            index === 0 ? "bg-muted font-medium" : "text-muted-foreground",
          )}
        >
          {t("tax.year", { year })}
        </span>
      ))}
    </div>
  );
}

function TaxBoxes({ compact }: { compact: boolean }) {
  const euro = useEuro();
  const { tax } = landingSampleFor(useLocale());
  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-3")}>
      {tax.boxes.map((box) => (
        <MockCard key={box.id} innerClassName={compact ? "p-4" : "p-5"}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium">{box.label}</p>
            <span className="rounded-md border border-border px-2 py-0.5 font-mono text-xs font-semibold">
              {box.id}
            </span>
          </div>
          <p
            className={cn(
              "mt-3 font-serif font-semibold tabular-nums",
              compact ? "text-2xl" : "text-3xl",
            )}
          >
            {euro(box.amount)}
          </p>
        </MockCard>
      ))}
    </div>
  );
}

export function TaxMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();
  const { tax } = landingSampleFor(useLocale());
  if (variant === "mobile") {
    return (
      <MockViewport width={MOBILE_WIDTH} height={MOBILE_HEIGHT}>
        <MobileShell active={ACTIVE_NAV.tax}>
          <YearChips />
          <p className="text-center text-xs text-muted-foreground">
            {t("tax.intro", { year: tax.year })}
          </p>
          <TaxBoxes compact />
        </MobileShell>
      </MockViewport>
    );
  }
  return (
    <MockViewport width={WEB_WIDTH} height={WEB_HEIGHT}>
      <WebShell active={ACTIVE_NAV.tax}>
        <div className="flex flex-1 flex-col gap-5">
          <YearChips />
          <p className="text-center text-sm text-muted-foreground">
            {t("tax.intro", { year: tax.year })}
          </p>
          <TaxBoxes compact={false} />
        </div>
      </WebShell>
    </MockViewport>
  );
}
