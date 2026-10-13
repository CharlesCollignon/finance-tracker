"use client";

import { useRef } from "react";
import { m, useInView, useReducedMotion } from "motion/react";
import { EASE_STANDARD } from "@finance/core/motion";
import type { AboutCopy } from "@/components/marketing/about-copy";
import { FadeUp, RiseWords } from "@/components/marketing/LandingReveal";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** The digits the total rolls through on its way down to nothing. */
const ROLL = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

/** When each row prints, and when the total starts to roll after them. */
const ROW_S = 0.16;
const ROWS_FROM_S = 0.25;

/**
 * « L'addition »: what Pluclair costs, as a bill. The rows print in one
 * after another as it comes into view — Pluclair itself, then what is
 * optional, marked so and paid to its own service — and the
 * total rolls down through the digits like a counter coming to rest, landing
 * on 0 in gold: the one figure on the page, and the reason it is gold.
 *
 * The prices sit beside the word "free" rather than in a footnote, which is
 * what keeps that word honest (see `about-copy.ts`). Under reduced motion
 * the card fades in once, already printed, and the total reads 0.
 */
export function Bill({
  copy,
  euroFirst,
}: {
  copy: AboutCopy["bill"];
  /** "€0" in English, "0 €" in French. */
  euroFirst: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.45 });
  const still = useReducedMotion() ?? false;
  const rollAt = ROWS_FROM_S + copy.rows.length * ROW_S + 0.1;

  return (
    <section className="relative px-6 py-24 md:py-36">
      <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <div>
          <RiseWords
            text={copy.heading}
            className="marketing-display text-display-section"
          />
          <FadeUp delay={0.1}>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-marketing-muted">
              {copy.intro}
            </p>
          </FadeUp>
        </div>

        <m.div
          ref={ref}
          className="glass-panel rounded-[1.75rem] p-6 md:p-9"
          initial={{ opacity: 0, y: 28 }}
          animate={seen ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <ul className="divide-y divide-white/10">
            {copy.rows.map((row, index) => (
              <m.li
                key={row.label}
                className="flex flex-col gap-2 py-5 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
                initial={{ opacity: 0, y: -10 }}
                animate={seen ? { opacity: 1, y: 0 } : undefined}
                transition={
                  still
                    ? { duration: 0 }
                    : {
                        duration: 0.55,
                        delay: ROWS_FROM_S + index * ROW_S,
                        ease: EASE,
                      }
                }
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-head text-lg text-marketing-ink">
                    {row.label}
                    {row.optional ? (
                      <span className="rounded-full border border-white/12 px-2.5 py-0.5 text-xs font-medium text-marketing-muted">
                        {copy.optional}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-marketing-faint">
                    {row.detail}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-marketing-muted tabular-nums sm:text-right">
                  {row.amount}
                </p>
              </m.li>
            ))}
          </ul>

          <div className="mt-2 flex items-end justify-between gap-6 border-t border-white/16 pt-6">
            <p className="pb-2 text-xs font-medium uppercase tracking-[0.16em] text-marketing-faint">
              {copy.totalLabel}
            </p>
            <Total
              seen={seen}
              still={still}
              delay={rollAt}
              euroFirst={euroFirst}
            />
          </div>

          <m.p
            className="mt-6 text-sm leading-relaxed text-marketing-faint"
            initial={{ opacity: 0 }}
            animate={seen ? { opacity: 1 } : undefined}
            transition={
              still
                ? { duration: 0 }
                : { duration: 0.6, delay: rollAt + 0.9, ease: EASE }
            }
          >
            {copy.footnote}
          </m.p>
        </m.div>
      </div>
    </section>
  );
}

/**
 * The total, in the figure face: a column of digits behind a mask, rolled
 * from 9 down to 0 once the rows have printed. It fades in as the roll
 * starts, so no digit but the last is ever read standing still — the bill
 * never says "9 €" — and it is one label to a screen reader, "0 €".
 */
function Total({
  seen,
  still,
  delay,
  euroFirst,
}: {
  seen: boolean;
  still: boolean;
  delay: number;
  euroFirst: boolean;
}) {
  const label = euroFirst ? "€0" : "0\u00A0€";
  // Under reduced motion the column starts where it would end, and nothing
  // waits: the same elements either way, so hydration has nothing to
  // reconcile but the values Motion writes on mount.
  const end = `-${((ROLL.length - 1) / ROLL.length) * 100}%`;
  const now = { duration: 0 };
  const euro = (
    <span className={euroFirst ? "mr-[0.06em]" : "ml-[0.14em]"}>€</span>
  );
  return (
    <p className="font-serif text-[clamp(2.75rem,8vw,4.5rem)] font-semibold leading-none tracking-[-0.035em] text-primary tabular-nums">
      {/* A paragraph cannot carry an aria-label, so the figure is said in
          text the eye does not see, and the roll is hidden from the ear. */}
      <span className="sr-only">{label}</span>
      <m.span
        aria-hidden
        className="flex items-baseline"
        initial={{ opacity: 0 }}
        animate={seen ? { opacity: 1 } : undefined}
        transition={still ? now : { duration: 0.3, delay, ease: EASE }}
      >
        {euroFirst ? euro : null}
        <span className="relative inline-block h-[1em] overflow-hidden">
          <m.span
            className="flex flex-col"
            initial={{ y: still ? end : "0%" }}
            animate={seen ? { y: end } : undefined}
            transition={still ? now : { duration: 1.5, delay, ease: EASE }}
          >
            {ROLL.map((digit) => (
              <span key={digit} className="block h-[1em] leading-none">
                {digit}
              </span>
            ))}
          </m.span>
        </span>
        {euroFirst ? null : euro}
      </m.span>
    </p>
  );
}
