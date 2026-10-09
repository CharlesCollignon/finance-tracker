"use client";

import { useRef } from "react";
import {
  m,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The three commitments, held on screen while they are read: the section is
 * pinned for a screen and a half, the sentence lighting word by word from
 * faint to full as the page scrolls through it, settling from a touch small
 * to its size, a horizon drawn out under it as the last words light.
 *
 * Under reduced motion it is a sentence on the page, lit.
 */
export function PromiseSection({ text }: { text: string }) {
  const ref = useRef<HTMLElement>(null);
  const still = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const words = text.split(" ");
  const scale = useTransform(
    scrollYProgress,
    [0, 0.8],
    still ? [1, 1] : [0.94, 1],
  );
  const horizon = useTransform(
    scrollYProgress,
    [0.55, 0.9],
    still ? [1, 1] : [0, 1],
  );

  return (
    <section
      ref={ref}
      className={cn(
        "relative overflow-x-clip px-6",
        still ? "py-24" : "h-[200vh]",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-5xl flex-col justify-center",
          !still && "sticky top-0 h-dvh",
        )}
      >
        <m.p
          className="marketing-display text-balance text-display-section text-marketing-ink"
          style={{ scale, transformOrigin: "0% 50%" }}
        >
          {words.map((word, index) => (
            <Word
              key={`${word}-${index}`}
              progress={scrollYProgress}
              from={(index / words.length) * 0.75}
              to={((index + 1) / words.length) * 0.75}
              still={still}
              last={index === words.length - 1}
            >
              {word}
            </Word>
          ))}
        </m.p>
        <m.div
          aria-hidden
          className="mt-12 h-px origin-left bg-gradient-to-r from-primary via-primary/30 to-transparent"
          style={{ scaleX: horizon }}
        />
      </div>
    </section>
  );
}

function Word({
  progress,
  from,
  to,
  still,
  last,
  children,
}: {
  progress: MotionValue<number>;
  from: number;
  to: number;
  still: boolean;
  last: boolean;
  children: string;
}) {
  const opacity = useTransform(
    progress,
    [from, to],
    still ? [1, 1] : [0.14, 1],
  );
  const y = useTransform(progress, [from, to], still ? [0, 0] : [6, 0]);
  return (
    <>
      <m.span className="inline-block" style={{ opacity, y }}>
        {children}
      </m.span>
      {last ? null : " "}
    </>
  );
}
