import type { CSSProperties } from "react";

/**
 * The hero's sky: a field of stars behind the horizon, at three depths.
 *
 * Laid out behind the orb, which is opaque, so every star under the rim is
 * hidden and the field shows only in the sky beyond it — a planet in front
 * of the stars, which is half of what makes it read as one. The haze in front
 * dims the ones nearest the rim, as an atmosphere would.
 *
 * Three layers make the depth (`.marketing-stars-*` in globals.css). The far
 * one is the many faint pinpricks and holds still; the middle and near ones
 * are fewer and brighter, and drift — the near more than the middle — so
 * they slip behind the rim and back out over a couple of minutes. Scrolling
 * moves them at three speeds too, the far layer lagging most, where the
 * browser has scroll-driven animations; elsewhere they simply hold. About
 * half the stars twinkle, slowly and out of step. Under reduced motion
 * nothing moves and nothing twinkles.
 *
 * Placed from a fixed seed rather than `Math.random()`: the server and the
 * browser must draw the same sky, or hydration fails, and a visitor should
 * not find different constellations on each visit.
 */

type Depth = "far" | "mid" | "near";

interface Star {
  depth: Depth;
  left: number;
  top: number;
  size: number;
  opacity: number;
  warm: boolean;
  /** Seconds; null for a star that holds still. */
  twinkle: { duration: number; delay: number } | null;
}

/** How many stars each depth holds, and how they look there. */
const DEPTHS: Record<
  Depth,
  {
    count: number;
    sizes: readonly number[];
    opacity: readonly [number, number];
    warm: number;
  }
> = {
  far: { count: 56, sizes: [1], opacity: [0.2, 0.45], warm: 0.1 },
  mid: { count: 36, sizes: [1, 1.5], opacity: [0.35, 0.65], warm: 0.2 },
  near: { count: 16, sizes: [1.5, 2, 2.5], opacity: [0.6, 0.95], warm: 0.4 },
};

const LAYERS: readonly Depth[] = ["far", "mid", "near"];

/** A small seeded generator (mulberry32): the same field on every render. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStars(): Star[] {
  const next = seeded(20261002);
  const round = (value: number) => Math.round(value * 100) / 100;
  return LAYERS.flatMap((depth) => {
    const { count, sizes, opacity, warm } = DEPTHS[depth];
    return Array.from({ length: count }, () => ({
      depth,
      left: round(next() * 100),
      top: round(next() * 100),
      size: sizes[Math.floor(next() * sizes.length)]!,
      opacity: round(opacity[0] + next() * (opacity[1] - opacity[0])),
      warm: next() < warm,
      twinkle:
        next() > 0.5
          ? { duration: round(3 + next() * 4), delay: round(next() * 6) }
          : null,
    }));
  });
}

const STARS = buildStars();

function starStyle(star: Star): CSSProperties {
  return {
    left: `${star.left}%`,
    top: `${star.top}%`,
    width: `${star.size}px`,
    height: `${star.size}px`,
    "--star-opacity": star.opacity,
    "--star-color": star.warm ? "255 246 224" : "255 255 255",
    ...(star.twinkle
      ? {
          "--star-duration": `${star.twinkle.duration}s`,
          "--star-delay": `${star.twinkle.delay}s`,
        }
      : {}),
  } as CSSProperties;
}

export function LandingStars({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      {LAYERS.map((depth) => (
        // Two boxes per layer: the outer one takes the scroll, the inner
        // one the drift, so the two movements never fight over a transform.
        <div
          key={depth}
          className={`marketing-stars-layer marketing-stars-${depth}`}
        >
          <div className="marketing-stars-drift">
            {STARS.filter((star) => star.depth === depth).map((star, index) => (
              <span
                key={index}
                className={
                  star.twinkle
                    ? "marketing-star marketing-star-twinkle"
                    : "marketing-star"
                }
                style={starStyle(star)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
