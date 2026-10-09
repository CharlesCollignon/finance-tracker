"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * The marketing site's scroll, smoothed: the wheel glides rather than steps,
 * which is what lets the pinned sections and the parallax read as one
 * movement instead of a series of jumps. Motion's `useScroll` reads the
 * window's own position, which Lenis moves, so every scroll-linked animation
 * follows it unchanged.
 *
 * Lenis turns its smoothing off under prefers-reduced-motion by itself
 * (`respectReducedMotion`); touch keeps the platform's own scrolling. In-page
 * links (`#how`, `#privacy`) glide too, stopping short of the header.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      anchors: { offset: -96 },
      stopInertiaOnNavigate: true,
    });
    return () => lenis.destroy();
  }, []);
  return null;
}
