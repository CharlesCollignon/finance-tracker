import { Orb } from "@/components/brand/Orb";
import { cn } from "@/lib/utils";

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
 *   The sphere itself, floating on a 16s cycle against the bloom's 11s, and
 *   inside it a 22s churn of cloud turning on a 45s shell, so no two of the
 *   four ever settle into one pulse the eye can lock onto.
 *
 * The bloom sits behind rather than around the glass on purpose: the orb
 * frosts whatever is behind it, so light put back there comes through the
 * shell diffused, which is the whole reason the sphere looks lit from within
 * rather than pasted on.
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
        <Orb className="marketing-orb relative h-full w-full" />
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
