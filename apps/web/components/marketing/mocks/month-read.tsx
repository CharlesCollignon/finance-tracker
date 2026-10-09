"use client";

import { Sparkle } from "@phosphor-icons/react";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import {
  MOCK_GLASS,
  WhereItWentMock,
} from "@/components/marketing/mocks/bearing";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  ACTIVE_NAV,
  MobileShell,
  type Variant,
  WebShell,
} from "@/components/marketing/mocks/frame";

/**
 * The month's read, as a landing mock (`./frame.tsx`). It is the last card
 * of Le point, under « Où c'est parti », so the mock is Le point scrolled
 * down to it, drawn as `MonthRead` draws it: who wrote it and from what,
 * the headline, the observations with their dots, what to look at more
 * closely set apart, and the line that dates it with its button.
 *
 * The prose is the sample's; its figures are written into it, where the
 * real card has the app put them in.
 */

/** The model the sample person chose on their AI account. */
const MODEL = "Claude";

function ReadCard({ phone }: { phone: boolean }) {
  const t = useT();
  const { read } = landingSampleFor(useLocale());
  const dot = {
    good: "bg-success",
    bad: "bg-destructive",
    flat: "bg-muted-foreground",
  };
  return (
    <section className={cn(MOCK_GLASS, "flex flex-col gap-4 p-5")}>
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkle size={14} className="text-muted-foreground" />
          {t("monthRead.title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t(phone ? "monthRead.subtitleMobile" : "monthRead.subtitleWeb", {
            model: MODEL,
          })}
        </p>
      </div>
      <p className="font-head text-lg leading-snug">{read.headline}</p>
      <ul className="flex flex-col gap-2">
        {read.observations.slice(0, phone ? 2 : 3).map((row, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <span
              className={cn(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                dot[row.tone],
              )}
            />
            <span className="min-w-0">{row.text}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("monthRead.suggestionsHeading")}
        </h3>
        {read.suggestions.map((suggestion) => (
          <p key={suggestion} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
            <span className="min-w-0">{suggestion}</span>
          </p>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 pt-3">
        <p className="text-xs text-muted-foreground">
          {read.standing} {t("monthRead.writtenBy", { model: MODEL })}
        </p>
        <span className="rounded-full border border-border px-3 py-1.5 text-xs font-medium">
          {t("monthRead.writeAgain", { left: 2, model: MODEL })}
        </span>
      </div>
    </section>
  );
}

export function MonthReadMock({ variant = "web" }: { variant?: Variant }) {
  if (variant === "mobile") {
    return (
      <MobileShell active={ACTIVE_NAV["month-read"]}>
        <ReadCard phone />
      </MobileShell>
    );
  }

  return (
    <WebShell active={ACTIVE_NAV["month-read"]}>
      <WhereItWentMock rows={3} />
      <ReadCard phone={false} />
    </WebShell>
  );
}
