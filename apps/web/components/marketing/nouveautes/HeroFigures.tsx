"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { easeOutCubic } from "@finance/core/motion";

/** Slower than the app's 650ms count: these arrive with the page. */
const COUNT_MS = 1400;

/**
 * The page's two figures — how many changes are listed, how many changes to
 * the code made them — counting up from nothing as the hero arrives.
 *
 * Set in the sans, not the figure face: they are counts, not money, and the
 * serif is for money (DESIGN.md, The Serif Is For Money Rule). Rendered at
 * their value on the server, so the page reads right without script; the
 * count starts once they are in view, behind the hero's fade. Under reduced
 * motion they stand at their value.
 */
export function HeroFigures({
  figures,
  locale,
}: {
  figures: { value: number; label: string }[];
  locale: string;
}) {
  return (
    <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-6">
      {figures.map((figure) => (
        <div key={figure.label} className="flex min-w-0 flex-col">
          <dt className="order-last mt-2 text-sm text-marketing-muted">
            {figure.label}
          </dt>
          <dd className="marketing-display text-display-sub tabular-nums">
            <CountUp value={figure.value} locale={locale} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CountUp({ value, locale }: { value: number; locale: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const still = useReducedMotion() ?? false;
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!inView || still) {
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_MS);
      setShown(Math.round(value * easeOutCubic(progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setShown(value);
    };
  }, [inView, still, value]);

  const format = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB");
  return (
    <span ref={ref}>
      <span className="sr-only">{format.format(value)}</span>
      <span aria-hidden>{format.format(shown)}</span>
    </span>
  );
}
