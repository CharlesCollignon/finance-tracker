import { cn } from "@/lib/utils";

/**
 * A faint aurora high in the hero's sky, behind the horizon.
 *
 * Three narrow bands in the landing's own family — blue-violet, magenta,
 * indigo — tilted the way the rim falls, each drifting and stretching on its
 * own slow cycle (`.marketing-aurora` in globals.css). Narrow on purpose: the
 * page already has a violet wash under everything (`.marketing-ambient`), and
 * a second wash over it only greys it out; what this adds is light that
 * moves, not more light.
 *
 * Behind the horizon like the stars, so the opaque planet hides every band
 * below its rim. Gradients rather than a blur filter: a `filter: blur()` over
 * a third of the screen is repainted on every frame it moves, and a soft
 * radial gradient is already soft. Still under reduced motion.
 */
export function LandingAurora({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <div className="marketing-aurora marketing-aurora-violet" />
      <div className="marketing-aurora marketing-aurora-magenta" />
      <div className="marketing-aurora marketing-aurora-indigo" />
    </div>
  );
}
