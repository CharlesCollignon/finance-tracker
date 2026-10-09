"use client";

import { useRef } from "react";
import {
  m,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { GoldOrb } from "@/components/marketing/landing/GoldOrb";
import { cn } from "@/lib/utils";

type FinalCopy = LocalisedLandingCopy["finalCta"];

/**
 * The close: the orb rising out of a horizon as the page reaches its end —
 * the hero's sunrise, answered — and the invitation arriving under it once
 * it has cleared the rim. Pinned for a little over a screen so the rise is
 * read rather than scrolled past.
 */
export function OrbFinale({
  copy,
  isLoggedIn,
}: {
  copy: FinalCopy;
  isLoggedIn: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const still = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const rise = useSpring(
    useTransform(scrollYProgress, [0.2, 0.85], [0, 1], { clamp: true }),
    { stiffness: 90, damping: 24, mass: 0.6 },
  );
  const words = useTransform(
    scrollYProgress,
    [0.6, 0.85],
    still ? [1, 1] : [0, 1],
  );
  const y = useTransform(words, [0, 1], [32, 0]);

  return (
    <section
      ref={ref}
      className={cn("relative", still ? "h-dvh" : "h-[170vh]")}
    >
      <div className="sticky top-0 h-dvh overflow-hidden">
        <GoldOrb rise={rise} />
        <m.div
          className="absolute inset-x-0 bottom-[12vh] mx-auto flex max-w-3xl flex-col items-center px-6 text-center"
          style={{ opacity: words, y }}
        >
          <h2 className="marketing-display text-display-section">
            {copy.heading}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-marketing-muted">
            {copy.body}
          </p>
          <LandingCtas
            isLoggedIn={isLoggedIn}
            size="lg"
            className="mt-8 justify-center"
          />
        </m.div>
      </div>
    </section>
  );
}
