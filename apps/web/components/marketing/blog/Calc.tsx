"use client";

import { useRef } from "react";
import { m, useInView, useReducedMotion } from "motion/react";
import { formatEuro } from "@finance/core/constants";
import { EASE_STANDARD } from "@finance/core/motion";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** When each line prints, and when the result comes after them. */
const LINE_S = 0.28;

/**
 * A worked sum, set the way the month close sets it: each line printing in
 * turn as it comes into view, signed, then the rule and the result in the
 * figure face — the one figure the example is about. An example's own
 * figures, not anyone's; under reduced motion, all of it is there at once.
 */
export function Calc({
  lines,
  result,
}: {
  lines: { label: string; amount: number }[];
  result: { label: string; amount: number; note?: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  const still = useReducedMotion() ?? false;
  const show = (index: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: seen ? { opacity: 1, y: 0 } : undefined,
    // Still: the same final state, in no time. Not `initial: false`: the
    // server cannot know the setting, and draws the lines hidden either way.
    transition: still
      ? { duration: 0 }
      : { duration: 0.5, ease: EASE, delay: index * LINE_S },
  });
  return (
    <div ref={ref} className="glass-flat my-10 rounded-[1.75rem] p-6 md:p-8">
      <ul className="flex flex-col gap-3">
        {lines.map((line, index) => (
          <m.li
            key={line.label}
            {...show(index)}
            className="flex items-baseline justify-between gap-6 text-[1rem]"
          >
            <span className="text-marketing-muted">{line.label}</span>
            <span className="shrink-0 tabular-nums text-marketing-ink">
              {line.amount > 0 && index > 0
                ? "+ "
                : line.amount < 0
                  ? "− "
                  : ""}
              {formatEuro(Math.abs(line.amount), "fr")}
            </span>
          </m.li>
        ))}
      </ul>
      <m.div
        {...show(lines.length)}
        className="mt-5 flex items-baseline justify-between gap-6 border-t border-white/15 pt-5"
      >
        <span className="font-head text-marketing-ink">{result.label}</span>
        <span className="shrink-0 font-serif text-3xl tabular-nums text-marketing-ink">
          {formatEuro(result.amount, "fr")}
        </span>
      </m.div>
      {result.note ? (
        <m.p
          {...show(lines.length + 1)}
          className="mt-3 text-sm leading-relaxed text-marketing-muted"
        >
          {result.note}
        </m.p>
      ) : null}
    </div>
  );
}
