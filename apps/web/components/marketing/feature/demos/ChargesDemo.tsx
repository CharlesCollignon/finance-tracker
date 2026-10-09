"use client";

import { useRef, useState } from "react";
import {
  m,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useLocale } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { Count } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["charges"];

/**
 * The month's recurring entries, from the sample's templates (`name` is
 * the template's index): the salary on the 3rd, the rent on the 5th, the
 * internet on the 10th, the savings on the 12th, Netflix on the 15th, the
 * health insurance on the 25th and the PEA DCA every Friday. What they
 * leave is the sample's `rollup.left`, the figure Récurrents leads with.
 */
const ENTRIES = [
  { day: 3, amount: 3200, name: 0 },
  { day: 5, amount: -850, name: 1 },
  { day: 6, amount: -50, name: 2 },
  { day: 10, amount: -30, name: 5 },
  { day: 12, amount: -150, name: 4 },
  { day: 13, amount: -50, name: 2 },
  { day: 15, amount: -15, name: 3 },
  { day: 20, amount: -50, name: 2 },
  { day: 25, amount: -64, name: 6 },
  { day: 27, amount: -50, name: 2 },
];

/**
 * The month on a calendar, filling as the page scrolls past it: each
 * recurring entry dropping onto its day, the salary first, and what the
 * month leaves counting down as the charges land.
 */
export function ChargesDemo({ copy }: { copy: Copy }) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const euro = useFormatCurrency();
  const still = useReducedMotion() ?? false;
  const sample = landingSampleFor(locale);
  const [landed, setLanded] = useState(still ? ENTRIES.length : 0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.45"],
  });
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (still) return;
    const next = Math.round(Math.min(1, Math.max(0, value)) * ENTRIES.length);
    setLanded((current) => (current === next ? current : next));
  });

  // March 2026 starts on a Sunday; Monday-first, as in France.
  const offset = (new Date(sample.year, sample.month - 1, 1).getDay() + 6) % 7;
  const days = new Date(sample.year, sample.month, 0).getDate();
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(
      new Date(2026, 2, 2 + index),
    ),
  );
  const left = ENTRIES.slice(0, landed).reduce(
    (sum, entry) => sum + entry.amount,
    0,
  );
  const nameOf = (index: number) => sample.templates[index]!.name;

  return (
    <div
      ref={ref}
      className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] md:items-end"
    >
      <div className="grid grid-cols-7 gap-1.5 text-xs">
        {weekdays.map((day, index) => (
          <span key={index} className="pb-1 text-center text-marketing-faint">
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const entryIndex = ENTRIES.findIndex((entry) => entry.day === day);
          const entry = entryIndex >= 0 ? ENTRIES[entryIndex] : undefined;
          const shown = entry !== undefined && entryIndex < landed;
          return (
            <div
              key={day}
              title={entry ? nameOf(entry.name) : undefined}
              className={cn(
                "relative flex h-14 flex-col justify-between overflow-hidden rounded-lg border p-1.5 transition-colors duration-300 md:h-16",
                shown
                  ? "border-white/20 bg-white/[0.05]"
                  : "border-white/[0.06]",
              )}
            >
              <span className="text-marketing-faint">{day}</span>
              {entry ? (
                <m.span
                  className={cn(
                    "truncate rounded px-1 py-0.5 text-center font-mono text-[10px] leading-none md:text-xs",
                    entry.amount > 0
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-primary/15 text-primary",
                  )}
                  initial={false}
                  animate={
                    shown
                      ? { opacity: 1, y: 0, scale: 1 }
                      : { opacity: 0, y: -18, scale: 0.6 }
                  }
                  transition={{ type: "spring", stiffness: 320, damping: 18 }}
                >
                  {entry.amount > 0 ? "+" : ""}
                  {Math.round(entry.amount)}
                </m.span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div>
        <p className="text-sm text-marketing-muted">{copy.left}</p>
        <p className="mt-1 font-serif text-[clamp(2.5rem,6vw,4rem)] font-semibold leading-none text-marketing-ink">
          <Count value={left} format={(value) => euro(Math.round(value))} />
        </p>
      </div>
    </div>
  );
}
