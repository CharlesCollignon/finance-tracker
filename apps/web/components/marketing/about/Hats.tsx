"use client";

import { useRef } from "react";
import { m, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { AboutCopy } from "@/components/marketing/about-copy";
import { FadeUp, RiseWords } from "@/components/marketing/LandingReveal";

/**
 * The three trades, one at a time: the heading holds still on the left while
 * the trades pass on the right, each lit as it crosses the middle of the
 * screen and dimmed again once it has gone by — the same light the promise
 * on the landing is read by, word by word, given here to whole ideas.
 *
 * Under reduced motion the three are simply lit.
 */
export function Hats({ copy }: { copy: AboutCopy["hats"] }) {
  return (
    <section className="relative px-6 py-24 md:py-36">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <div className="md:sticky md:top-32 md:self-start">
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
        <ul>
          {copy.items.map((item) => (
            <Hat key={item.title} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Hat({ item }: { item: { title: string; body: string } }) {
  const ref = useRef<HTMLLIElement>(null);
  const still = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const opacity = useTransform(
    scrollYProgress,
    [0.15, 0.42, 0.62, 0.9],
    still ? [1, 1, 1, 1] : [0.14, 1, 1, 0.14],
  );
  const x = useTransform(
    scrollYProgress,
    [0.15, 0.42],
    still ? [0, 0] : [-28, 0],
  );

  return (
    <li
      ref={ref}
      className="flex min-h-[44vh] flex-col justify-center border-t border-white/10 py-10 last:border-b md:min-h-[58vh]"
    >
      <m.div style={{ opacity, x }}>
        <h3 className="marketing-display text-display-section">{item.title}</h3>
        <p className="mt-5 max-w-md text-base leading-relaxed text-marketing-muted md:text-lg">
          {item.body}
        </p>
      </m.div>
    </li>
  );
}
