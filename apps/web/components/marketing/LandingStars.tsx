import type { CSSProperties } from "react";

/**
 * The hero's sky: a field of stars behind the horizon.
 *
 * Laid out behind the orb, which is opaque, so every star under the rim is
 * hidden and the field shows only in the sky beyond it — a planet in front
 * of the stars, which is half of what makes it read as one. The haze in front
 * dims the ones nearest the rim, as an atmosphere would.
 *
 * Placed from a fixed seed rather than `Math.random()`: the server and the
 * browser must draw the same sky, or hydration fails, and the same visitor
 * should not find different constellations on each visit. Most stars are
 * faint pinpricks; a few are brighter and warm, the way a long exposure
 * picks out the near ones. About half twinkle, slowly and out of step; under
 * reduced motion none do (`.marketing-star` in globals.css).
 */

interface Star {
  left: number;
  top: number;
  size: number;
  opacity: number;
  warm: boolean;
  /** Seconds; null for a star that holds still. */
  twinkle: { duration: number; delay: number } | null;
}

const STAR_COUNT = 90;

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

function buildStars(count: number): Star[] {
  const next = seeded(20261002);
  const round = (value: number) => Math.round(value * 100) / 100;
  return Array.from({ length: count }, () => {
    const kind = next();
    // Seven in ten a pinprick, a quarter a little larger, the rest bright.
    const bright = kind > 0.95;
    const small = !bright && kind > 0.7;
    return {
      left: round(next() * 100),
      top: round(next() * 100),
      size: bright ? 2 : small ? 1.5 : 1,
      opacity: round(
        bright
          ? 0.8 + next() * 0.15
          : small
            ? 0.45 + next() * 0.3
            : 0.25 + next() * 0.3,
      ),
      warm: bright || next() > 0.8,
      twinkle:
        next() > 0.5
          ? { duration: round(3 + next() * 4), delay: round(next() * 6) }
          : null,
    };
  });
}

const STARS = buildStars(STAR_COUNT);

export function LandingStars({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      {STARS.map((star, index) => (
        <span
          key={index}
          className={
            star.twinkle
              ? "marketing-star marketing-star-twinkle"
              : "marketing-star"
          }
          style={
            {
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
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
