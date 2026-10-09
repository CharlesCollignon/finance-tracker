"use client";

import { CaretDown, Info } from "@phosphor-icons/react";
import { taxRulesFor, type TaxBoxId } from "@finance/core/tax-return";
import type { Key } from "@finance/core/i18n/t";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { MOCK_GLASS } from "@/components/marketing/mocks/bearing";
import {
  ACTIVE_NAV,
  MobileShell,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * « Déclaration de revenus », as a landing mock (`./frame.tsx`), drawn as
 * `TaxView` draws it: the year, the line that says what the figures are,
 * then a card per box — its label and rule, its code, the amount, the
 * categories filed in it (or where the app reads it from) and how many
 * operations it adds up — and the footer that says what Pluclair does not
 * do. Reached from Profile, so no tab is lit; on the phone it is a screen
 * pushed over the tabs.
 */

function YearChips({ phone }: { phone: boolean }) {
  const t = useT();
  const { tax } = landingSampleFor(useLocale());
  return (
    <div
      className={cn(
        "flex gap-1 self-center rounded-full p-1 text-sm",
        !phone && "border border-border",
      )}
    >
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

function Boxes({ phone }: { phone: boolean }) {
  const t = useT();
  const euro = useEuro();
  const { tax } = landingSampleFor(useLocale());
  const { rules } = taxRulesFor(tax.year);
  return (
    <div className={cn("grid gap-4", phone ? "grid-cols-1" : "grid-cols-2")}>
      {tax.boxes.map((box) => {
        const rule = rules.boxes.find((each) => each.id === box.id)!;
        const words = `tax.boxes.${box.id as TaxBoxId}`;
        return (
          <section
            key={box.id}
            className={cn(MOCK_GLASS, "flex flex-col gap-3 p-5")}
          >
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t(`${words}.label` as Key)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(`${words}.rule` as Key, {
                    ceiling: rule.ceiling === null ? "" : euro(rule.ceiling),
                  })}
                </p>
              </div>
              <span className="shrink-0 rounded-control border border-border px-2 py-0.5 font-mono text-sm font-semibold">
                {box.id}
              </span>
            </header>
            <p className="font-serif text-3xl font-semibold tracking-tight tabular-nums">
              {euro(box.amount)}
            </p>
            {box.category ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground">
                  {t("tax.categoriesHint")}
                </p>
                <span className="self-start rounded-full border border-foreground bg-foreground px-2.5 py-1 text-xs text-background">
                  {box.category}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("tax.fromRentFurnished")}
              </p>
            )}
            <span className="mt-auto flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {t("tax.rows", { count: box.rows })}
              <CaretDown size={12} />
            </span>
          </section>
        );
      })}
    </div>
  );
}

export function TaxMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();
  const { tax } = landingSampleFor(useLocale());
  const { rules } = taxRulesFor(tax.year);
  const phone = variant === "mobile";

  const intro = (
    <div className="flex flex-col gap-1 text-center">
      <p className="text-sm text-muted-foreground">
        {t("tax.intro", { year: tax.year })}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("tax.forms", { forms: rules.formsYear })}
      </p>
    </div>
  );

  if (phone) {
    return (
      <MobileShell active={ACTIVE_NAV.tax} back>
        <YearChips phone />
        {intro}
        <Boxes phone />
      </MobileShell>
    );
  }

  return (
    <WebShell active={ACTIVE_NAV.tax}>
      <YearChips phone={false} />
      {intro}
      <Boxes phone={false} />
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info size={14} className="mt-0.5 shrink-0" />
        {t("tax.footer")}
      </p>
    </WebShell>
  );
}
