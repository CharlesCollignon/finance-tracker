import { cn } from "@/lib/utils";

interface SiriOrbProps {
  /**
   * A CSS length for both axes. Left off, the orb takes its size from
   * `className` — which is how the hero uses it, since a fluid
   * `min(58vw,352px)` cannot be written here as a number. The blur scales off
   * the rendered width either way (see `.siri-orb` in globals.css).
   */
  size?: string;
  className?: string;
  /** c1 highlight, c2 body, c3 shadow. Defaults are the marketing golds. */
  colors?: { c1?: string; c2?: string; c3?: string };
  /** Seconds for one full turn of the plasma. */
  animationDuration?: number;
}

/**
 * A sphere of turning light: five conic gradients blurred into each other,
 * driven by a single registered `--angle`.
 *
 * The whole thing is one empty div and a stylesheet, which is what keeps it a
 * server component. The CSS lives in globals.css beside the rest of the
 * marketing surface rather than in a `<style jsx>` block, because styled-jsx
 * in the App Router needs a client component and a style registry — a steep
 * price for a decoration, and it would put the hero behind a hydration wait.
 */
export function SiriOrb({
  size,
  className,
  colors,
  animationDuration,
}: SiriOrbProps) {
  return (
    <div
      className={cn("siri-orb", className)}
      style={
        {
          width: size,
          height: size,
          "--orb-c1": colors?.c1,
          "--orb-c2": colors?.c2,
          "--orb-c3": colors?.c3,
          "--orb-duration": animationDuration
            ? `${animationDuration}s`
            : undefined,
        } as React.CSSProperties
      }
      aria-hidden
    />
  );
}

/**
 * The hero artwork.
 *
 * Three layers, back to front:
 *
 *   The bloom — the warm light the sphere throws into the room. Sized by the
 *   box rather than by gradient stops so a caller scales the light by scaling
 *   the element.
 *
 *   The contact smear — a flattened, brighter pool under the sphere. Without
 *   it the orb hangs in the middle of nothing; with it the hero has a floor.
 *
 *   The sphere itself, floating on a 16s cycle against the bloom's 11s and
 *   turning inside on a 22s, so no two of the three ever settle into one
 *   pulse the eye can lock onto.
 */
export function LandingOrb({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none select-none", className)}
      aria-hidden
    >
      <div className="relative h-full w-full">
        <div
          className="marketing-bloom marketing-bloom-breathe absolute -inset-[38%] rounded-full"
          style={{ filter: "blur(12px)" }}
        />
        <div
          className="marketing-bloom absolute left-1/2 top-[62%] h-[26%] w-[135%] -translate-x-1/2 rounded-[50%] opacity-70"
          style={{ filter: "blur(28px)" }}
        />
        <SiriOrb className="marketing-orb relative h-full w-full" />
      </div>
    </div>
  );
}

/**
 * The bloom on its own, for sections that want the sphere's light without a
 * second sphere competing with the hero's. Always decorative.
 */
export function LandingBloom({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "marketing-bloom marketing-bloom-breathe pointer-events-none absolute rounded-full",
        className,
      )}
      style={{ filter: "blur(16px)" }}
      aria-hidden
    />
  );
}
