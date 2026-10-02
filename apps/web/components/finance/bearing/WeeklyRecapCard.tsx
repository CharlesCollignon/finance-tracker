"use client";

import { useState, useTransition } from "react";
import { CalendarCheck } from "@phosphor-icons/react";
import { monthLong } from "@finance/core/i18n/calendar-names";
import { weeklyRecapLines, type WeeklyRecap } from "@finance/core/weekly-recap";
import { dismissWeeklyRecap } from "@/lib/actions/weekly-recap";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { PRIVACY_MASK, usePrivacyOn } from "@/lib/use-privacy";
import { cn } from "@/lib/utils";

/**
 * Monday's recap, as a card: the push opened, in the same sentences, one to
 * a line. Put away with « Vu », for the week and on every device.
 *
 * The amounts are formatted here rather than on the server, in this
 * browser's currency, and masked rather than blurred in privacy mode: they
 * sit inside sentences, where a blur would hide the words around them too.
 */
export function WeeklyRecapCard({ recap }: { recap: WeeklyRecap }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const hidden = usePrivacyOn();
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [, startTransition] = useTransition();

  if (gone) {
    return null;
  }

  const lines = weeklyRecapLines(recap, {
    t,
    formatMoney: (amount) => (hidden ? PRIVACY_MASK : format(amount)),
    previousMonthName: monthLong(recap.monthSoFar.previousMonth, locale),
  });

  function dismiss() {
    setLeaving(true);
    startTransition(async () => {
      await dismissWeeklyRecap(recap.weekOf);
    });
  }

  return (
    <section
      aria-label={t("recap.title")}
      className={cn(
        GLASS_CARD,
        "page-enter flex flex-col gap-3 rounded-card p-card",
        "transition-[opacity,transform] duration-200",
        leaving && "scale-[0.98] opacity-0",
      )}
      onTransitionEnd={(event) => {
        if (leaving && event.target === event.currentTarget) {
          setGone(true);
        }
      }}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
            <CalendarCheck size={ICON.sm} />
          </span>
          {t("recap.title")}
        </h2>
        <button
          type="button"
          onClick={dismiss}
          disabled={leaving}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
        >
          {t("recap.dismiss")}
        </button>
      </header>
      <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
