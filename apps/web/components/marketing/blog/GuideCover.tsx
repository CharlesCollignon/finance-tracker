"use client";

import { useRef } from "react";
import Image from "next/image";
import { m, useReducedMotion, useScroll, useTransform } from "motion/react";
import { GUIDE_COVERS } from "@/lib/guide-covers";
import type { GuideSlug } from "@/lib/guide-list";
import { cn } from "@/lib/utils";

/**
 * A guide's photo (`GUIDE_COVERS`), cropped to its frame around what matters
 * in it, and settled into the room: its foot shaded into the ground, a
 * hairline of glass at its edge. On a card it leans in a little under the
 * pointer; at the top of a guide it drifts slower than the page as it is
 * scrolled past. Under reduced motion it holds still.
 *
 * On a card the title beside it says what the guide is, so the photo is
 * decoration there; at the top of a guide it is described (`describe`).
 */
export function GuideCover({
  slug,
  sizes,
  className,
  first = false,
  describe = false,
  drift = false,
}: {
  slug: GuideSlug;
  /** How wide it is drawn, for `next/image` to pick the size to send. */
  sizes: string;
  className?: string;
  /** Above the fold on arrival: fetched first, not lazily. */
  first?: boolean;
  describe?: boolean;
  drift?: boolean;
}) {
  const photo = GUIDE_COVERS[slug];
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    drift && !still ? ["-7%", "7%"] : ["0%", "0%"],
  );

  return (
    <div
      ref={ref}
      aria-hidden={describe ? undefined : true}
      className={cn(
        "relative isolate overflow-hidden bg-[var(--marketing-ground)]",
        className,
      )}
    >
      {/* Taller than its frame when it drifts, so no edge ever shows. */}
      <m.div
        className={cn(
          "absolute inset-x-0",
          drift ? "-inset-y-[9%]" : "inset-y-0",
        )}
        style={{ y }}
      >
        <Image
          src={photo.image}
          alt={describe ? photo.alt : ""}
          fill
          sizes={sizes}
          placeholder="blur"
          loading={first ? "eager" : "lazy"}
          fetchPriority={first ? "high" : "auto"}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          style={{ objectPosition: photo.focus }}
        />
      </m.div>
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--marketing-ground)]/60 via-transparent to-black/10" />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
    </div>
  );
}
