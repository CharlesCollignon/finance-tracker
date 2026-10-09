"use client";

import { useRef } from "react";
import {
  m,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { formatDayMonth } from "@finance/core/constants";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useLocale } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

type FigureCopy = LocalisedLandingCopy["figure"];

/**
 * « Il vous reste », put together as the page is scrolled: pinned for a
 * couple of screens while the figure counts from the accounts down to what
 * is left, each term of the subtraction sliding in as it is taken off, the
 * rule drawn under them, and the result lit gold with its per-day beside it.
 * The arithmetic is the app's (`@finance/core/left-to-spend`), on the sample
 * month's figures.
 *
 * Under reduced motion the section is not pinned and every value stands at
 * its end: the full sum, written out.
 */
export function FigureSection({ copy }: { copy: FigureCopy }) {
  const ref = useRef<HTMLElement>(null);
  const still = useReducedMotion() ?? false;
  const locale = useLocale();
  const euro = useFormatCurrency();
  const { leftToSpend } = landingSampleFor(locale);
  const date = formatDayMonth(leftToSpend.through, locale);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const p = useTransform(scrollYProgress, (value) => (still ? 1 : value));

  // The figure: the balance arriving, then each term taken off in turn.
  const afterCharges = leftToSpend.balance - leftToSpend.charges;
  const figure = useTransform(
    p,
    [0.02, 0.22, 0.32, 0.48, 0.58, 0.72],
    [
      0,
      leftToSpend.balance,
      leftToSpend.balance,
      afterCharges,
      afterCharges,
      leftToSpend.amount,
    ],
  );
  const figureText = useTransform(figure, (value) => euro(Math.round(value)));
  const done = useTransform(p, [0.7, 0.78], [0, 1]);
  const gold = useTransform(
    done,
    [0, 1],
    ["rgb(255 255 255 / 0.85)", "rgb(236 178 94 / 1)"],
  );
  const rule = useTransform(p, [0.62, 0.74], [0, 1]);
  const perDayY = useTransform(done, [0, 1], [16, 0]);
  const glow = useTransform(done, [0, 1], [0.7, 1]);
  const noteOpacity = useTransform(p, [0.8, 0.9], [0, 1]);

  return (
    <section
      ref={ref}
      className={cn("relative px-6", still ? "py-24" : "h-[280vh]")}
      aria-label={copy.heading}
    >
      <div
        className={cn(
          "mx-auto flex max-w-6xl flex-col justify-center gap-12 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center md:gap-16",
          !still && "sticky top-0 h-dvh",
        )}
      >
        <div>
          <h2 className="marketing-display text-display-section">
            {copy.heading}
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-marketing-muted">
            {copy.body}
          </p>
        </div>

        <div className="relative">
          {/* The light the figure sits in, swelling as the sum resolves. */}
          <m.div
            aria-hidden
            className="pointer-events-none absolute -inset-16 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(236_178_94/0.22),transparent)] blur-2xl"
            style={{ opacity: done, scale: glow }}
          />
          <dl className="flex flex-col gap-3 font-mono text-sm tabular-nums sm:text-base">
            <Term
              progress={p}
              range={[0.04, 0.16]}
              label={copy.balance}
              value={euro(leftToSpend.balance)}
            />
            <Term
              progress={p}
              range={[0.3, 0.42]}
              label={copy.charges.replace("{date}", date)}
              value={`−${euro(leftToSpend.charges)}`}
            />
            <Term
              progress={p}
              range={[0.5, 0.62]}
              label={copy.marge}
              value={`−${euro(leftToSpend.marge)}`}
            />
          </dl>
          <m.div
            aria-hidden
            className="mt-5 h-px origin-left bg-gradient-to-r from-primary/80 via-white/30 to-transparent"
            style={{ scaleX: rule }}
          />
          <p className="mt-6 text-lg text-marketing-muted sm:text-xl">
            {copy.title}
          </p>
          <m.p
            className="mt-1 font-serif text-[clamp(3.5rem,13vw,8.5rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums"
            style={{ color: gold }}
          >
            {figureText}
          </m.p>
          <m.p
            className="mt-4 flex flex-wrap items-center gap-3 text-base text-marketing-ink sm:text-lg"
            style={{ opacity: done, y: perDayY }}
          >
            <span>{copy.until.replace("{date}", date)}</span>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm text-primary">
              {copy.perDay.replace("{amount}", euro(leftToSpend.perDay))}
            </span>
          </m.p>
          <m.p
            className="mt-8 text-sm text-marketing-faint"
            style={{ opacity: noteOpacity }}
          >
            {copy.note}
          </m.p>
        </div>
      </div>
    </section>
  );
}

/** One term of the sum, sliding in from the left as it is taken off. */
function Term({
  progress,
  range,
  label,
  value,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  label: string;
  value: string;
}) {
  const opacity = useTransform(progress, range, [0, 1]);
  const x = useTransform(progress, range, [-28, 0]);
  return (
    <m.div
      className="flex items-baseline justify-between gap-6 border-b border-white/10 pb-3"
      style={{ opacity, x }}
    >
      <dt className="font-sans text-marketing-muted">{label}</dt>
      <dd className="text-marketing-ink">{value}</dd>
    </m.div>
  );
}
