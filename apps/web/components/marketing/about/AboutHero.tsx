"use client";

import type { PointerEvent } from "react";
import Image from "next/image";
import {
  m,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { EASE_STANDARD } from "@finance/core/motion";
import { Orb } from "@/components/brand/Orb";
import type { AboutCopy } from "@/components/marketing/about-copy";
import { LandingBloom } from "@/components/marketing/LandingOrb";
import { FadeUp, RiseLines } from "@/components/marketing/LandingReveal";
import { LiveStatus } from "@/components/marketing/LiveStatus";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** How the portrait follows the pointer: quick to answer, slow to settle. */
const TILT = { stiffness: 160, damping: 18, mass: 0.6 } as const;

/**
 * The page opens on a greeting, the way a letter does: the name rising out
 * of its mask line by line, the beta's status above it, and beside it the
 * portrait rising out of the same horizon — a photo in the bezel's tray, or
 * until there is one the orb, lit in the frame. The portrait leans toward
 * the pointer and drifts a little slower than the page as it scrolls away.
 *
 * Under reduced motion nothing leans or drifts, and everything is in place.
 */
export function AboutHero({
  copy,
  portrait,
}: {
  copy: AboutCopy["hero"];
  portrait: string | null;
}) {
  return (
    <section className="relative isolate overflow-x-clip px-6 pb-20 pt-32 md:pb-28 md:pt-44">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem]"
        aria-hidden
      >
        <div className="marketing-sparks absolute inset-0 opacity-60" />
      </div>
      <div className="mx-auto grid max-w-6xl items-end gap-14 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-16">
        <div className="min-w-0">
          <FadeUp trigger="mount" delay={0.1}>
            <LiveStatus label={copy.status} />
          </FadeUp>
          <RiseLines
            lines={copy.titleLines}
            className="marketing-display mt-8 text-display-hero"
            delay={0.25}
          />
          <FadeUp trigger="mount" delay={0.8}>
            <p className="mt-6 max-w-xl text-[0.975rem] leading-relaxed text-marketing-muted sm:text-lg">
              {copy.intro}
            </p>
          </FadeUp>
        </div>
        <Portrait
          src={portrait}
          alt={copy.portraitAlt}
          name={copy.name}
          place={copy.place}
        />
      </div>
    </section>
  );
}

function Portrait({
  src,
  alt,
  name,
  place,
}: {
  src: string | null;
  alt: string;
  name: string;
  place: string;
}) {
  const still = useReducedMotion() ?? false;
  // Where the pointer is over the portrait, from -0.5 to 0.5 on each axis.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [7, -7]), TILT);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), TILT);
  const { scrollY } = useScroll();
  const drift = useTransform(scrollY, [0, 700], still ? [0, 0] : [0, -56]);

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (still) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - box.left) / box.width - 0.5);
    py.set((event.clientY - box.top) / box.height - 0.5);
    // The glint follows the pointer too: two custom properties, no render.
    event.currentTarget.style.setProperty(
      "--x",
      `${event.clientX - box.left}px`,
    );
    event.currentTarget.style.setProperty(
      "--y",
      `${event.clientY - box.top}px`,
    );
  }

  function onPointerLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <m.div
      className="relative mx-auto w-full max-w-sm [perspective:1200px] md:mx-0 md:max-w-none"
      style={{ y: drift }}
    >
      <LandingBloom className="left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 opacity-60" />
      {/* It rises in a beat after the name, and settles. No mask here, unlike
          the name's: a mask would clip the corners as the frame leans. */}
      <m.figure
        className="group relative rounded-[26px] bg-[rgba(236,236,241,0.04)] p-1.5"
        initial={{ y: 56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.15, delay: 0.45, ease: EASE }}
        style={still ? undefined : { rotateX, rotateY }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-background shadow-[inset_0_1px_1px_rgba(255,246,230,0.08)]">
          {src ? (
            <Image
              src={src}
              alt={alt}
              fill
              priority
              sizes="(min-width: 768px) 40vw, 90vw"
              className="object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 grid place-items-center [background:radial-gradient(70%_55%_at_50%_42%,rgb(139_74_255/0.22),transparent_70%)]"
              aria-hidden
            >
              <Orb size="clamp(9rem, 24vw, 15rem)" />
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 [background:radial-gradient(18rem_circle_at_var(--x,50%)_var(--y,30%),rgb(255_255_255/0.12),transparent_60%)] group-hover:opacity-100"
            aria-hidden
          />
        </div>
        <figcaption className="flex items-center justify-between gap-4 px-3 pb-1.5 pt-3 text-xs font-medium uppercase tracking-[0.16em] text-marketing-faint">
          <span>{name}</span>
          <span>{place}</span>
        </figcaption>
      </m.figure>
    </m.div>
  );
}
