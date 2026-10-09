"use client";

import { useEffect, useRef, useState } from "react";
import {
  m,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { FeatureMock } from "@/components/marketing/LandingMocks";
import type {
  LandingPageId,
  LocalisedLandingCopy,
} from "@/components/marketing/landing-copy";
import Link from "next/link";
import { featureHref } from "@/components/marketing/landing-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

type GalleryCopy = LocalisedLandingCopy["gallery"];

/** Wide enough for the desktop layout to be the one drawn, as on a laptop. */
const DESKTOP = "(min-width: 768px)";

/**
 * « Sur grand écran »: the desktop screens on a track that runs sideways as
 * the page scrolls down — the section pinned while the track crosses it.
 * Each screen leans in as it nears the middle, comes flat and full size
 * there, and leans away as it leaves, so the row reads as a turning reel
 * rather than a strip sliding past. A thin rail under it says how far along.
 *
 * Below the desktop width it is a row to swipe, with no pinning: a phone
 * scrolls a carousel natively, and pinning one there fights the thumb.
 * Under reduced motion, the same row to scroll by hand.
 */
export function ScreenGallery({ copy }: { copy: GalleryCopy }) {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const still = useReducedMotion() ?? false;
  const [distance, setDistance] = useState(0);

  // How far the track has to travel for its last screen to end at the
  // right edge: measured, since it depends on the window's width.
  useEffect(() => {
    const media = window.matchMedia(DESKTOP);
    const measure = () => {
      const element = track.current;
      if (!element || !media.matches || still) {
        setDistance(0);
        return;
      }
      setDistance(Math.max(0, element.scrollWidth - window.innerWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (track.current) {
      observer.observe(track.current);
    }
    media.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, [still]);

  const pinned = distance > 0;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 32,
    mass: 0.4,
  });
  const x = useTransform(progress, [0, 1], [0, -distance]);
  const count = copy.items.length;

  return (
    <section
      ref={ref}
      className="relative"
      // A screen of scroll per screen of track, so the reel moves at the
      // speed the reader scrolls.
      style={pinned ? { height: `calc(100vh + ${distance}px)` } : undefined}
    >
      <div
        className={cn(
          "flex flex-col justify-center gap-8 overflow-hidden py-24 md:gap-10",
          pinned && "sticky top-0 h-dvh pb-8 pt-24",
        )}
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          <h2 className="marketing-display text-display-section">
            {copy.heading}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-marketing-muted">
            {copy.body}
          </p>
        </div>

        <m.div
          ref={track}
          className={cn(
            "flex w-max gap-8 px-6 md:gap-12 md:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]",
            !pinned &&
              "w-full snap-x snap-mandatory overflow-x-auto pb-4 [scrollbar-width:none]",
          )}
          style={pinned ? { x } : undefined}
          data-lenis-prevent-horizontal
        >
          {copy.items.map((item, index) => (
            <Slide
              key={item.id}
              pageId={item.id as LandingPageId}
              caption={item.caption}
              index={index}
              count={count}
              progress={progress}
              animated={pinned}
            />
          ))}
        </m.div>

        {pinned ? (
          <div className="mx-auto h-px w-full max-w-6xl px-6">
            <div className="h-px bg-white/10">
              <m.div
                className="h-px origin-left bg-primary"
                style={{ scaleX: progress }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Slide({
  pageId,
  caption,
  index,
  count,
  progress,
  animated,
}: {
  pageId: LandingPageId;
  caption: string;
  index: number;
  count: number;
  progress: MotionValue<number>;
  animated: boolean;
}) {
  // Where along the reel this screen sits at the middle of the window.
  const centre = count === 1 ? 0.5 : index / (count - 1);
  const near = [centre - 0.45, centre, centre + 0.45];
  const rotateY = useTransform(
    progress,
    near,
    animated ? [-16, 0, 16] : [0, 0, 0],
  );
  const scale = useTransform(
    progress,
    near,
    animated ? [0.9, 1, 0.9] : [1, 1, 1],
  );
  const opacity = useTransform(
    progress,
    near,
    animated ? [0.45, 1, 0.45] : [1, 1, 1],
  );
  // The screen inside its frame lags a little behind the frame: parallax.
  const inner = useTransform(
    progress,
    near,
    animated ? [24, 0, -24] : [0, 0, 0],
  );

  return (
    // Sized from the window's height on a desktop, so the heading, the
    // screen and its caption always fit in it together.
    <figure className="m-0 w-[86vw] shrink-0 snap-center [perspective:1800px] md:w-[min(64rem,72vw,calc((100dvh-19rem)*2.76))]">
      <m.div style={{ rotateY, scale, opacity }} className="origin-center">
        <Link
          href={featureHref(pageId)}
          className={cn(
            "group block overflow-hidden rounded-[1.6rem] bg-white/[0.04] p-2 ring-1 ring-white/10 transition-[box-shadow] duration-300 hover:ring-white/25",
            marketingFocus,
          )}
        >
          {/* The top of the screen, where its figures are: the desktop
              layouts leave their lower part to lists a picture does not
              need, so the slide is cut there and fades. */}
          <div className="aspect-[1200/434] overflow-hidden rounded-[1.2rem] bg-background [mask-image:linear-gradient(to_bottom,black_78%,transparent)]">
            <m.div
              className="-ml-[2%] aspect-[12/7] w-[104%]"
              style={{ x: inner }}
            >
              <FeatureMock pageId={pageId} variant="web" />
            </m.div>
          </div>
        </Link>
      </m.div>
      <figcaption className="mt-5 text-lg text-marketing-ink md:text-xl">
        {caption}
      </figcaption>
    </figure>
  );
}
