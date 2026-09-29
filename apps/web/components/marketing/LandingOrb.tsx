import { Orb } from "@/components/brand/Orb";
import { cn } from "@/lib/utils";

/**
 * The hero's sky: the orb as a horizon, several viewports across, its lit rim
 * arcing from under the header on the left to off the bottom-right corner.
 *
 * Three layers, back to front:
 *
 *   The haze — the light the atmosphere scatters out into space, wide and
 *   dim, breathing on an 11s cycle.
 *
 *   The limb — a thin hot band hugging the outside of the rim, the
 *   atmosphere seen edge-on.
 *
 *   The sphere itself, opaque, which is what shapes the other two: both are
 *   plain discs centred on it, and it hides everything of them but the part
 *   beyond its edge. Each is nudged toward the light, so what shows is a
 *   crescent that is thickest where the rim burns and gone on the far side.
 *
 * Where the planet sits, and why its size steps with the screen's shape as
 * well as its width, is `.marketing-horizon-planet` in globals.css.
 *
 * The wrapper fades the whole thing out over the hero's last stretch, so the
 * rim leaves the section as light going out rather than on a cut.
 */
export function LandingHorizon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 select-none overflow-hidden",
        "[mask-image:linear-gradient(to_bottom,black_68%,transparent)]",
        className,
      )}
      aria-hidden
    >
      <div className="marketing-horizon-planet">
        <div className="marketing-horizon-haze marketing-horizon-breathe absolute inset-[-14%] translate-x-[7.5%] -translate-y-[2%] rounded-full" />
        <div className="marketing-horizon-limb absolute inset-[-1.6%] translate-x-[1.1%] -translate-y-[0.3%] rounded-full" />
        <Orb tone="horizon" className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}

/**
 * The bloom on its own, for sections that want the sphere's light without a
 * sphere competing with the hero's horizon. Always decorative.
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
