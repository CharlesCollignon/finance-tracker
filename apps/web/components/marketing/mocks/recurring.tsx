"use client";

import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { Badge } from "@/components/ui/Badge";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  MobileShell,
  MockCard,
  type Variant,
  WebHero,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/** Récurrents, as a landing mock (`./frame.tsx`). */

/* --------------------------------------------------------------- recurring */

/** The share-priced template is the one worth pointing at: its amount comes
 * from a quote rather than a figure anyone typed.
 *
 * Matched on the id rather than the name. The name is translated — "PEA DCA"
 * is "DCA PEA" in French — so a name comparison silently stopped finding this
 * template, and the badge it controls simply never appeared for a French
 * reader. The schedule line moved out for the same reason and now lives in
 * the sample beside the rest of the words. */
const SHARE_PRICED = "pea-dca";

export function RecurringMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { templates } = sample;
  const monthlyImpact = templates
    .filter((template) => template.amount < 0)
    .reduce(
      (sum, template) =>
        sum +
        Math.abs(template.amount) * (template.cadence === "weekly" ? 4.33 : 1),
      0,
    );

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.charges">
        <MockCard innerClassName="flex flex-row items-center justify-between p-4">
          <p className="text-sm font-bold">
            {t("marketingMock.expectedImpact")}
          </p>
          <p className="font-mono text-lg font-bold tabular-nums">
            {euro(monthlyImpact)}
          </p>
        </MockCard>
        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <MockCard key={template.name} innerClassName="p-3">
              <p className="text-sm font-semibold">{template.name}</p>
              <p className="text-xs text-muted-foreground">
                {template.schedule}
                {template.id === SHARE_PRICED
                  ? ` · ${t("marketingMock.oneShare")}`
                  : null}
              </p>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span
                  className={cn(
                    "font-mono text-sm font-bold tabular-nums",
                    TYPE_AMOUNT_CLASS[template.type],
                  )}
                >
                  {template.amount >= 0 ? "+" : "−"}
                  {euro(Math.abs(template.amount))}
                </span>
                <span className="rounded-full border border-primary-rim bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  {t("recurring.on")}
                </span>
              </div>
            </MockCard>
          ))}
        </div>
      </MobileShell>
    );
  }

  return (
    // No month stepper: only the Ledger carries one. `TransactionsView` and
    // `CalendarView` are the two `MonthPicker` call sites in the app, and
    // Charges renders a bare `<PageHeader titleKey="nav.charges" />`. A
    // template is not a month's row, which is the reason the real header has
    // nothing to step through here.
    <WebShell active="nav.charges">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-6 py-6">
            <WebHero
              label={t("marketingMock.expectedImpactPerMonth")}
              amount={euro(monthlyImpact)}
              subtitle={
                <p>
                  {t("marketingMock.templatesAllApplied", {
                    count: templates.length,
                  })}
                </p>
              }
            />
          </MockCard>
        </div>
        <div className="col-span-8">
          <MockCard innerClassName="divide-y divide-border px-3 py-1.5">
            {templates.map((template) => (
              <div
                key={template.name}
                className="flex items-center justify-between gap-3 px-2 py-3"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold">{template.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {template.schedule}
                    {template.id === SHARE_PRICED
                      ? ` · ${t("marketingMock.oneShareAtQuote")}`
                      : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {template.id === SHARE_PRICED ? (
                    <Badge variant="outline" size="sm" className="rounded-full">
                      {t("marketingMock.sharePriced")}
                    </Badge>
                  ) : null}
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      TYPE_AMOUNT_CLASS[template.type],
                    )}
                  >
                    {template.amount >= 0 ? "+" : "−"}
                    {euro(Math.abs(template.amount))}
                  </span>
                  <Badge variant="surface" size="sm" className="rounded-full">
                    {t("recurring.on")}
                  </Badge>
                </div>
              </div>
            ))}
          </MockCard>
        </div>
      </div>
    </WebShell>
  );
}
