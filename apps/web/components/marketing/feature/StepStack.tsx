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
 * The three things you do on a screen, as cards laid one on another: each
 * pins under the header as it arrives, the next slides up over it, and the
 * one beneath steps back — smaller, dimmer — so the order reads as a pile
 * being made. Under reduced motion they are three cards, one after another.
 */
export function StepStack({
  steps,
}: {
  steps: readonly { title: string; body: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const count = steps.length;

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-4xl px-6">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className={cn(
            !still && "sticky",
            index < count - 1 ? "pb-[38vh]" : "pb-16",
          )}
          style={still ? undefined : { top: `calc(7rem + ${index * 1.4}rem)` }}
        >
          <Card
            step={step}
            index={index}
            count={count}
            progress={scrollYProgress}
            still={still}
          />
        </div>
      ))}
    </div>
  );
}

function Card({
  step,
  index,
  count,
  progress,
  still,
}: {
  step: { title: string; body: string };
  index: number;
  count: number;
  progress: MotionValue<number>;
  still: boolean;
}) {
  // Each card steps back once for every card laid on it.
  const start = (index + 1) / count;
  const scale = useTransform(
    progress,
    [start - 1 / count, 1],
    still || index === count - 1 ? [1, 1] : [1, 1 - (count - 1 - index) * 0.06],
  );
  const dim = useTransform(
    progress,
    [start - 1 / count, 1],
    still || index === count - 1 ? [0, 0] : [0, 0.45],
  );
  return (
    <m.article
      className="relative overflow-hidden rounded-[2rem] border border-white/10 [background:linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02)_55%),#0b0b12] p-8 shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.9)] md:p-12"
      style={{ scale, transformOrigin: "50% 0%" }}
    >
      <p className="font-mono text-xs text-marketing-faint">
        {index + 1} / {count}
      </p>
      <h2 className="marketing-display mt-4 text-display-sub">{step.title}</h2>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-marketing-muted md:text-lg">
        {step.body}
      </p>
      <m.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: dim }}
      />
    </m.article>
  );
}
