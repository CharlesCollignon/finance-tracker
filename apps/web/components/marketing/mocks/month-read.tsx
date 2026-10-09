"use client";

import { Sparkle } from "@phosphor-icons/react";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  ACTIVE_NAV,
  MOBILE_HEIGHT,
  MOBILE_WIDTH,
  MobileHero,
  MobileShell,
  MockCard,
  MockViewport,
  SpendSplit,
  type Variant,
  WEB_HEIGHT,
  WEB_WIDTH,
  WebHero,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/** The month read, as a landing mock (`./frame.tsx`). */

/* -------------------------------------------------------------- the router */

/* -------------------------------------------------------------- month read */

/**
 * The read card, as the app draws it: a headline, observations under a tone
 * dot each, and suggestions below a rule under a heading of their own.
 *
 * The dots carry the tone rather than the text being coloured — a whole
 * sentence in red reads as an error, and "this went up" is not one.
 */
function ReadCard({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const sample = landingSampleFor(useLocale());
  const { read } = sample;
  const dot = {
    good: "bg-success",
    bad: "bg-destructive",
    flat: "bg-muted-foreground",
  };

  return (
    <MockCard innerClassName={compact ? "p-4" : "p-5"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkle size={14} className="text-primary-rim" />
          {t("marketingMock.monthRead")}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {read.writtenOn}
        </span>
      </div>

      <p
        className={cn(
          "mt-3 font-head leading-snug",
          compact ? "text-base" : "text-lg",
        )}
      >
        {read.headline}
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {read.observations
          .slice(0, compact ? 2 : 3)
          .map((observation, index) => (
            <li
              key={index}
              className={cn(
                "flex items-start gap-2",
                compact ? "text-[11px]" : "text-sm",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  dot[observation.tone],
                )}
              />
              <span className="min-w-0 text-muted-foreground">
                {observation.text}
              </span>
            </li>
          ))}
      </ul>

      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("monthRead.suggestionsHeading")}
        </h4>
        {read.suggestions.map((suggestion) => (
          <div
            key={suggestion}
            className={cn(
              "flex items-start gap-2",
              compact ? "text-[11px]" : "text-sm",
            )}
          >
            <span
              aria-hidden
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-rim"
            />
            <span className="min-w-0 text-muted-foreground">{suggestion}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
        {read.standing}
      </p>
    </MockCard>
  );
}

export function MonthReadMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { monthLabel, remaining, income } = sample;

  const monthWord = monthLabel.split(" ")[0];

  if (variant === "mobile") {
    return (
      <MockViewport width={MOBILE_WIDTH} height={MOBILE_HEIGHT}>
        <MobileShell active={ACTIVE_NAV["month-read"]}>
          <MockCard innerClassName="p-4">
            <MobileHero
              label={t("marketingStat.leftIn", { month: monthWord! })}
              amount={euro(remaining)}
              subtitle={t("marketingStat.ofEarned", { amount: euro(income) })}
            />
          </MockCard>
          <ReadCard compact />
        </MobileShell>
      </MockViewport>
    );
  }

  return (
    <MockViewport width={WEB_WIDTH} height={WEB_HEIGHT}>
      {/* Plan, and no stepper — see the Charges mock. */}
      <WebShell active={ACTIVE_NAV["month-read"]}>
        {/* Seven and five, the same split the surface itself uses on a wide
            screen: the read sits under the figure it interprets, never
            beside it. */}
        <div className="grid flex-1 grid-cols-12 gap-4">
          <div className="col-span-7 flex flex-col gap-4">
            <MockCard innerClassName="p-5">
              <WebHero
                label={t("marketingStat.leftIn", { month: monthWord! })}
                amount={euro(remaining)}
                subtitle={t("marketingStat.ofEarned", { amount: euro(income) })}
              />
            </MockCard>
            <ReadCard />
          </div>
          <div className="col-span-5">
            <MockCard innerClassName="p-4">
              <SpendSplit compact />
            </MockCard>
          </div>
        </div>
      </WebShell>
    </MockViewport>
  );
}
