"use client";

import { useState } from "react";
import { formatDayMonth } from "@finance/core/constants";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { Count, Range } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["bearing"];

/** The sample month's today, the 19th: what is still to come starts after it. */
const TODAY = 19;

/** The balance on `day`: the curve's last point on or before it. */
function balanceOn(curve: readonly [number, number][], day: number): number {
  let value = curve[0]![1];
  for (const [at, balance] of curve) {
    if (at <= day) {
      value = balance;
    }
  }
  return value;
}

/** What the curve still takes out after `day`: each step down, summed. */
function leavingAfter(curve: readonly [number, number][], day: number): number {
  let leaving = 0;
  for (let index = 1; index < curve.length; index++) {
    const [at, balance] = curve[index]!;
    const step = balance - curve[index - 1]![1];
    if (at > day && step < 0) {
      leaving -= step;
    }
  }
  return leaving;
}

/**
 * Le point's balance card, played: the days of the sample month on a slider
 * from today to its end, the balance on that day and what is still to go out
 * after it — under the balance, as the card puts it — answering as it moves,
 * down to nothing on the 31st. The figures are the sample's curve
 * (`landing-sample.ts`, `bearingMonth`), the same the landing's mock draws.
 */
export function BearingDemo({ copy }: { copy: Copy }) {
  const t = useT();
  const locale = useLocale();
  const euro = useFormatCurrency();
  const { bearingMonth, year, month } = landingSampleFor(locale);
  const { curve } = bearingMonth;
  const lastDay = curve[curve.length - 1]![0];
  const [day, setDay] = useState(TODAY);

  const date = (at: number) =>
    formatDayMonth(
      `${year}-${String(month).padStart(2, "0")}-${String(at).padStart(2, "0")}`,
      locale,
    );
  const leaving = leavingAfter(curve, day);

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center">
      <Range
        label={copy.dayLabel}
        value={day}
        min={TODAY}
        max={lastDay}
        onChange={setDay}
        display={date(day)}
      />

      <div aria-live="polite">
        <p className="text-lg text-marketing-muted">
          {copy.day.replace("{date}", date(day))}
        </p>
        <p className="mt-1 font-serif text-[clamp(3rem,8vw,5.5rem)] font-semibold leading-none tracking-[-0.035em]">
          <Count
            value={balanceOn(curve, day)}
            format={(value) => euro(Math.round(value))}
            className="text-marketing-ink"
          />
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-sm text-marketing-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
          {t("bearingMonth.toGoOut", { amount: euro(leaving) })}
        </p>
        <p className="mt-4 text-sm text-marketing-muted">
          {t("bearingMonth.expectedEnd")}{" "}
          <span className="font-mono text-marketing-ink">
            {euro(balanceOn(curve, lastDay))}
          </span>
        </p>
      </div>
    </div>
  );
}
