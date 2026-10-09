"use client";

import { useState } from "react";
import { m } from "motion/react";
import { formatMonthLabel, shiftMonth } from "@finance/core/constants";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useLocale } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { Range } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["plan"];

/** What the sample's savings hold today, and the milestones after it. */
const SAVED = 7800;
const MILESTONES = [5000, 10000, 25000, 50000];
/** The timeline's span, in months. */
const SPAN = 72;

/**
 * The milestones, moved by hand: what is set aside each month on a slider,
 * and each milestone sliding along a six-year line to the month it would be
 * passed in — the ones already passed lit gold at the start.
 */
export function PlanDemo({ copy }: { copy: Copy }) {
  const locale = useLocale();
  const euro = useFormatCurrency();
  const { year, month } = landingSampleFor(locale);
  const [monthly, setMonthly] = useState(650);

  const months = (target: number) =>
    target <= SAVED ? 0 : Math.ceil((target - SAVED) / monthly);

  return (
    <div className="flex flex-col gap-12">
      <Range
        label={copy.monthly}
        value={monthly}
        min={100}
        max={2000}
        step={50}
        onChange={setMonthly}
        display={euro(monthly)}
      />
      <div className="relative h-40">
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
        {MILESTONES.map((target, index) => {
          const away = months(target);
          const at = Math.min(away, SPAN) / SPAN;
          const passed = away === 0;
          const when = shiftMonth(year, month, away);
          return (
            <m.div
              key={target}
              className="absolute top-1/2 flex -translate-x-1/2 flex-col items-center"
              initial={false}
              animate={{
                left: `${4 + at * 92}%`,
                opacity: away > SPAN ? 0.35 : 1,
              }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            >
              <span
                className={cn(
                  "absolute flex flex-col items-center whitespace-nowrap text-center",
                  index % 2 === 0 ? "bottom-4" : "top-4",
                )}
              >
                <span className="font-mono text-sm text-marketing-ink">
                  {euro(target)}
                </span>
                <span className="text-xs text-marketing-muted">
                  {passed
                    ? copy.reached
                    : `${copy.inMonths.replace("{count}", String(away))} · ${formatMonthLabel(when.year, when.month, locale)}`}
                </span>
              </span>
              <span
                className={cn(
                  "-translate-y-1/2 rounded-full border-2",
                  passed
                    ? "size-4 border-primary bg-primary shadow-[0_0_20px_rgb(236_178_94/0.7)]"
                    : "size-3.5 border-white/60 bg-[#0b0b12]",
                )}
              />
            </m.div>
          );
        })}
      </div>
    </div>
  );
}
