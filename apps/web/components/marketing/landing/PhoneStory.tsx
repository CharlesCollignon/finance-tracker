"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  m,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { EASE_STANDARD } from "@finance/core/motion";
import Link from "next/link";
import { FeatureMock } from "@/components/marketing/LandingMocks";
import {
  featureHref,
  type LandingPageId,
  type LocalisedLandingCopy,
} from "@/components/marketing/landing-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { Phone3D } from "@/components/marketing/landing/Phone3D";
import { cn } from "@/lib/utils";

type StoryCopy = LocalisedLandingCopy["story"];

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/**
 * « Comment ça marche »: the month, chapter by chapter, on a phone that turns
 * as the page scrolls. The section is pinned for a screen a chapter; the
 * phone swings in from the side, settles, and leans a little one way then
 * the other as each chapter hands over to the next, while its screen slides
 * from one part of the app to the next and the chapter's words rise beside
 * it. A gold rail fills with the reading.
 *
 * The turn is the scroll's, softened by a spring so a flick of the wheel
 * does not snap the phone round. Under reduced motion it stands straight and
 * the screens cross-fade.
 */
export function PhoneStory({ copy }: { copy: StoryCopy }) {
  const ref = useRef<HTMLElement>(null);
  const still = useReducedMotion() ?? false;
  const chapters = copy.chapters;
  const count = chapters.length;
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    mass: 0.4,
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(count - 1, Math.max(0, Math.floor(value * count)));
    setActive((current) => (current === next ? current : next));
  });

  // In from the side, then a lean each way per chapter, then away.
  const turnStops = Array.from({ length: count + 1 }, (_, i) => i / count);
  const turnValues = turnStops.map((_, i) =>
    i === 0 ? -32 : i === count ? 22 : i % 2 === 0 ? 9 : -9,
  );
  const rotateY = useTransform(
    progress,
    turnStops,
    still ? turnStops.map(() => 0) : turnValues,
  );
  const rotateX = useTransform(
    progress,
    [0, 0.12, 1],
    still ? [0, 0, 0] : [14, 4, 8],
  );
  const y = useTransform(
    progress,
    [0, 0.5, 1],
    still ? [0, 0, 0] : [20, -14, 6],
  );
  const rail = useTransform(progress, [0, 1], [0, 1]);

  return (
    <section
      id="how"
      ref={ref}
      className="relative overflow-x-clip px-6"
      style={{ height: `${count * 100 + 60}vh` }}
    >
      <div className="sticky top-0 mx-auto grid h-dvh max-w-6xl grid-rows-[auto_minmax(0,1fr)] items-center gap-6 py-20 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:grid-rows-1 md:gap-16 md:py-0">
        <div className="relative flex flex-col gap-6 md:order-1">
          <div>
            <h2 className="marketing-display text-display-section">
              {copy.heading}
            </h2>
            <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-marketing-faint md:block">
              {copy.body}
            </p>
          </div>

          <div className="flex gap-5">
            {/* The rail: one tick per chapter, gold up to the one in view. */}
            <div className="relative hidden w-px shrink-0 bg-white/10 md:block">
              <m.div
                className="absolute inset-x-0 top-0 h-full origin-top bg-primary"
                style={{ scaleY: rail }}
              />
            </div>
            <ol className="flex flex-col gap-1">
              {chapters.map((chapter, index) => (
                <li key={chapter.id}>
                  {index === active ? (
                    <Link
                      href={featureHref(chapter.id as LandingPageId)}
                      className={cn(
                        "group inline-flex items-center gap-2 font-head text-lg text-marketing-ink md:text-2xl",
                        marketingFocus,
                      )}
                    >
                      {chapter.title}
                      <ArrowRight
                        size={16}
                        aria-hidden
                        className="text-primary transition-transform duration-200 group-hover:translate-x-1"
                      />
                    </Link>
                  ) : (
                    <p className="hidden font-head text-2xl text-marketing-faint/60 md:block">
                      {chapter.title}
                    </p>
                  )}
                  <AnimatePresence initial={false}>
                    {index === active ? (
                      <m.p
                        key={chapter.id}
                        initial={{ opacity: 0, y: 14, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        transition={{ duration: 0.55, ease: EASE }}
                        className="max-w-md overflow-hidden pb-4 pt-2 text-base leading-relaxed text-marketing-muted"
                      >
                        {chapter.body}
                      </m.p>
                    ) : null}
                  </AnimatePresence>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="relative flex h-full min-h-0 items-center justify-center md:order-2">
          {/* The phone's own light, behind it. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[min(34rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(236_178_94/0.16),transparent)] blur-2xl"
          />
          <Phone3D
            rotateX={rotateX}
            rotateY={rotateY}
            y={y}
            className="h-full max-h-[min(78vh,44rem)] w-auto [aspect-ratio:9/19.5] md:max-h-[min(80vh,46rem)]"
          >
            {chapters.map((chapter, index) => (
              <Screen
                key={chapter.id}
                pageId={chapter.id as LandingPageId}
                index={index}
                count={count}
                progress={progress}
                still={still}
              />
            ))}
          </Phone3D>
        </div>
      </div>
    </section>
  );
}

/**
 * One chapter's screen. The next one wipes up over it from the bottom of the
 * glass as its chapter starts, while this one steps back — a little smaller,
 * a little darker — like a card under the one laid on it. The first is there
 * from the start; the last stays to the end. Under reduced motion each one
 * simply replaces the one before.
 */
function Screen({
  pageId,
  index,
  count,
  progress,
  still,
}: {
  pageId: LandingPageId;
  index: number;
  count: number;
  progress: MotionValue<number>;
  still: boolean;
}) {
  const start = index / count;
  const end = (index + 1) / count;
  const edge = 0.14 / count;
  const first = index === 0;
  const last = index === count - 1;

  const enter = [start - edge, start + edge];
  const leave = [end - edge, end + edge];
  const clipPath = useTransform(
    progress,
    enter,
    first || still
      ? ["inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
      : ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"],
  );
  const opacity = useTransform(
    progress,
    enter,
    first ? [1, 1] : still ? [0, 1] : [1, 1],
  );
  const scale = useTransform(
    progress,
    leave,
    last || still ? [1, 1] : [1, 0.92],
  );
  const dim = useTransform(progress, leave, last || still ? [0, 0] : [0, 0.55]);

  return (
    <m.div
      className="absolute inset-0 origin-top"
      style={{ clipPath, opacity, scale }}
    >
      <FeatureMock pageId={pageId} variant="mobile" />
      <m.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: dim }}
      />
    </m.div>
  );
}
