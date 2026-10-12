"use client";

import { useRef } from "react";
import {
  m,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Orb } from "@/components/brand/Orb";
import type { AboutCopy } from "@/components/marketing/about-copy";
import { FadeUp, RiseWords } from "@/components/marketing/LandingReveal";
import { cn } from "@/lib/utils";

type Stop = AboutCopy["run"]["items"][number];

/**
 * Where the line is drawn to, and where a stop lights: the same height on
 * the screen, so the tip of the line and the dot it reaches agree.
 */
const READ_AT = "55%";

/**
 * The run from the first line of code to the beta, as a line the scroll
 * draws down the page. Each stop's dot fills in gold as the line reaches it
 * — gold meaning done, as a milestone passed is in Plan — and the last stop,
 * today, is the orb. On a phone the line runs down the left; from the
 * tablet up it runs down the middle, the stops either side of it in turn.
 *
 * Under reduced motion the line is drawn and every stop is lit.
 */
export function Run({ copy }: { copy: AboutCopy["run"] }) {
  const ref = useRef<HTMLOListElement>(null);
  const still = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: [`start ${READ_AT}`, `end ${READ_AT}`],
  });
  const drawn = useTransform(scrollYProgress, [0, 1], still ? [1, 1] : [0, 1]);

  return (
    <section className="relative px-6 py-24 md:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <RiseWords
            text={copy.heading}
            className="marketing-display text-display-section"
          />
          <FadeUp delay={0.1}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-marketing-muted">
              {copy.note}
            </p>
          </FadeUp>
        </div>

        <ol ref={ref} className="relative mt-16 md:mt-24">
          <span
            aria-hidden
            className="absolute bottom-0 left-[7px] top-0 w-px bg-white/10 md:left-1/2"
          />
          <m.span
            aria-hidden
            className="absolute bottom-0 left-[7px] top-0 w-px origin-top bg-gradient-to-b from-white/50 via-white/40 to-primary md:left-1/2"
            style={{ scaleY: drawn }}
          />
          {copy.items.map((stop, index) => (
            <Stop
              key={stop.date}
              stop={stop}
              side={index % 2 === 0 ? "left" : "right"}
              last={index === copy.items.length - 1}
              still={still}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

function Stop({
  stop,
  side,
  last,
  still,
}: {
  stop: Stop;
  side: "left" | "right";
  last: boolean;
  still: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  // From the dot's top reaching a little below the reading line to it
  // reaching the line: lit by the time the line's tip is there.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 62%", `start ${READ_AT}`],
  });
  const lit = useTransform(scrollYProgress, [0, 1], still ? [1, 1] : [0, 1]);

  return (
    <li
      ref={ref}
      className="relative grid pb-14 pl-10 last:pb-0 md:grid-cols-2 md:gap-16 md:pb-20 md:pl-0"
    >
      <Dot lit={lit} last={last} />
      <FadeUp
        className={cn(
          side === "left" ? "md:col-start-1 md:text-right" : "md:col-start-2",
        )}
      >
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-marketing-faint">
          {stop.date}
        </p>
        <h3 className="mt-2 font-head text-xl text-marketing-ink md:text-2xl">
          {stop.title}
        </h3>
        <p
          className={cn(
            "mt-2 max-w-sm text-sm leading-relaxed text-marketing-muted md:text-base",
            side === "left" && "md:ml-auto",
          )}
        >
          {stop.body}
        </p>
      </FadeUp>
    </li>
  );
}

/** A hairline ring that fills in gold once the line has reached it. */
function Dot({ lit, last }: { lit: MotionValue<number>; last: boolean }) {
  const scale = useTransform(lit, [0, 1], [0.3, 1]);
  return (
    <span
      aria-hidden
      className="absolute left-0 top-0.5 grid size-[15px] place-items-center md:left-1/2 md:-translate-x-1/2"
    >
      {last ? (
        <m.span
          className="grid place-items-center"
          style={{ opacity: lit, scale }}
        >
          <Orb size="22px" tone="mark" />
        </m.span>
      ) : (
        <>
          <span className="absolute inset-0 rounded-full border border-white/25 bg-[var(--marketing-ground)]" />
          <m.span
            className="relative size-[9px] rounded-full bg-primary"
            style={{ opacity: lit, scale }}
          />
        </>
      )}
    </span>
  );
}
