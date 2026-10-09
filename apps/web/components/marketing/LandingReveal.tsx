"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { Plus } from "@phosphor-icons/react";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

/**
 * How the marketing site moves: one motif, said several ways.
 *
 * Things rise out of a horizon. The hero is a planet's rim with a sun coming
 * up behind it, so the headline's lines rise out of a mask as the planet
 * fades in, the headings rise word by word as they come into view, the app's
 * screens tilt up from their bottom edge and settle as the page is scrolled,
 * and the promise sentence lights word by word as it is read. One curve
 * (`EASE_STANDARD`) for all of it, transforms and opacity only — but for the
 * questions' answers, which open to their height.
 *
 * Under prefers-reduced-motion, `MotionConfig` drops every transform from
 * the triggered animations — what is left arrives as it is — and the
 * scroll-linked ones map every scroll position to where they come to rest.
 * Mapped, not removed: the server renders their first values into the
 * style, hydration does not correct a style attribute, and only Motion,
 * writing its values on mount, takes them back out.
 *
 * `LazyMotion` with `domAnimation`: animations, variants, exits and
 * gestures, without the layout engine the app's nav loads.
 */

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** How long a rise takes, a little slower than a block's enter: it travels. */
const RISE_S = 0.95;
const WORD_STEP_S = 0.045;
const LINE_STEP_S = 0.12;

export function MarketingMotion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

type Trigger = "mount" | "view";

/** Animate on first paint, or once when half of it is in view. */
function play(trigger: Trigger) {
  return trigger === "mount"
    ? ({ initial: "hidden", animate: "shown" } as const)
    : ({
        initial: "hidden",
        whileInView: "shown",
        viewport: { once: true, amount: 0.5 },
      } as const);
}

const piece = {
  hidden: { y: "112%" },
  shown: { y: "0%", transition: { duration: RISE_S, ease: EASE } },
};

const TAGS = { h1: m.h1, h2: m.h2, h3: m.h3, p: m.p } as const;

/**
 * A mask a piece of type rises out of. The padding keeps descenders — the g
 * of « argent », the ç of « ça » — inside it, and the negative margin gives
 * the line its height back.
 */
const MASK = "overflow-hidden pb-[0.14em] -mb-[0.14em]";

/** Lines of a heading, each rising out of its own mask, one after another. */
export function RiseLines({
  lines,
  as = "h1",
  className,
  delay = 0,
  trigger = "mount",
}: {
  lines: string[];
  as?: keyof typeof TAGS;
  className?: string;
  delay?: number;
  trigger?: Trigger;
}) {
  const Tag = TAGS[as];
  return (
    <Tag
      className={className}
      aria-label={lines.join(" ")}
      {...play(trigger)}
      variants={{
        hidden: {},
        shown: {
          transition: { staggerChildren: LINE_STEP_S, delayChildren: delay },
        },
      }}
    >
      {lines.map((line) => (
        <span key={line} aria-hidden className={cn("block", MASK)}>
          <m.span className="block" variants={piece}>
            {line}
          </m.span>
        </span>
      ))}
    </Tag>
  );
}

/** A heading whose words rise out of the horizon one after another. */
export function RiseWords({
  text,
  as = "h2",
  className,
  delay = 0,
  trigger = "view",
}: {
  text: string;
  as?: keyof typeof TAGS;
  className?: string;
  delay?: number;
  trigger?: Trigger;
}) {
  const Tag = TAGS[as];
  const words = text.split(" ");
  return (
    <Tag
      className={className}
      aria-label={text}
      {...play(trigger)}
      variants={{
        hidden: {},
        shown: {
          transition: { staggerChildren: WORD_STEP_S, delayChildren: delay },
        },
      }}
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden>
          <span className={cn("inline-block align-bottom", MASK)}>
            <m.span className="inline-block" variants={piece}>
              {word}
            </m.span>
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}

/** A block arriving: a short lift and a fade, after the headings it serves. */
export function FadeUp({
  children,
  className,
  delay = 0,
  trigger = "view",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  trigger?: Trigger;
}) {
  return (
    <m.div
      className={className}
      {...play(trigger)}
      variants={{
        hidden: { opacity: 0, y: 14 },
        shown: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.8, delay, ease: EASE },
        },
      }}
    >
      {children}
    </m.div>
  );
}

/**
 * A screen of the app landing as the page scrolls to it: tilted back on its
 * bottom edge, low and a little small, it comes up and flattens into place
 * by the time its top is two fifths of the way down the window — tied to the
 * scroll, so it moves as fast as the reader does.
 */
export function Land({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start 0.4"],
  });
  const rotateX = useTransform(
    scrollYProgress,
    [0, 1],
    still ? [0, 0] : [16, 0],
  );
  const y = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [80, 0]);
  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    still ? [1, 1] : [0.92, 1],
  );
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.55],
    still ? [1, 1] : [0, 1],
  );
  return (
    <div ref={ref} className={cn("[perspective:1400px]", className)}>
      <m.div
        style={{ rotateX, y, scale, opacity, transformOrigin: "50% 100%" }}
      >
        {children}
      </m.div>
    </div>
  );
}

/**
 * The hero's text as the page scrolls away from it: it drifts up faster
 * than the page and fades, so the planet behind seems to stay.
 */
export function HeroDrift({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const still = useReducedMotion() ?? false;
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], still ? [0, 0] : [0, -90]);
  const opacity = useTransform(scrollY, [0, 480], still ? [1, 1] : [1, 0]);
  return (
    <m.div className={className} style={{ y, opacity }}>
      {children}
    </m.div>
  );
}

/**
 * The Earth as the page scrolls away from it: it comes slowly closer and
 * sinks a little, a layer deeper than the text.
 */
export function HeroDepth({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const still = useReducedMotion() ?? false;
  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, [0, 900], still ? [1, 1] : [1, 1.1]);
  const y = useTransform(scrollY, [0, 900], still ? [0, 0] : [0, 70]);
  return (
    <m.div className={className} style={{ scale, y }}>
      {children}
    </m.div>
  );
}

/**
 * The questions, one open at a time, each answer opening and closing in
 * place rather than snapping.
 */
export function Questions({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-white/10 border-y border-white/10">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                id={`question-${index}`}
                aria-expanded={isOpen}
                aria-controls={`answer-${index}`}
                onClick={() => setOpen(isOpen ? null : index)}
                className={cn(
                  "flex w-full items-center justify-between gap-6 rounded-control py-5 text-left font-head text-lg text-marketing-ink",
                  marketingFocus,
                )}
              >
                {item.question}
                <m.span
                  aria-hidden
                  className="shrink-0 text-marketing-muted"
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: DURATION.hover / 1000, ease: EASE }}
                >
                  <Plus size={16} />
                </m.span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <m.div
                  id={`answer-${index}`}
                  role="region"
                  aria-labelledby={`question-${index}`}
                  className="overflow-hidden"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: DURATION.panel / 1000, ease: EASE }}
                >
                  <p className="max-w-xl pb-6 text-base leading-relaxed text-marketing-muted">
                    {item.answer}
                  </p>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
