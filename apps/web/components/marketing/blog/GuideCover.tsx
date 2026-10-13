import type { CSSProperties } from "react";
import { Orb } from "@/components/brand/Orb";
import { cn } from "@/lib/utils";

/** Where each cover's two lights sit, by the guide's `cover` number. */
const LIGHTS: Record<number, CSSProperties> = {
  1: {
    "--cover-a-x": "28%",
    "--cover-a-y": "35%",
    "--cover-b-x": "82%",
    "--cover-b-y": "18%",
  } as CSSProperties,
  2: {
    "--cover-a-x": "70%",
    "--cover-a-y": "30%",
    "--cover-b-x": "15%",
    "--cover-b-y": "25%",
  } as CSSProperties,
  3: {
    "--cover-a-x": "50%",
    "--cover-a-y": "20%",
    "--cover-b-x": "88%",
    "--cover-b-y": "60%",
  } as CSSProperties,
};

/**
 * A guide's picture: the room's own light, placed its own way, a few sparks,
 * and the orb rising out of a horizon low on the frame — the landing's
 * sunrise, small. Decorative; the title beside it says what it is.
 */
export function GuideCover({
  seed,
  className,
}: {
  seed: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("guide-cover relative isolate overflow-hidden", className)}
      style={LIGHTS[((seed - 1) % 3) + 1]}
    >
      <div className="marketing-sparks absolute inset-0 opacity-50" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] guide-cover-horizon" />
      {/* Centred on the horizon, so the ground below hides its lower half:
          the sun coming up, as on the landing. */}
      <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 translate-y-1/2">
        <Orb size="clamp(3rem, 9vw, 6.5rem)" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[14%] bg-[var(--marketing-ground)]" />
    </div>
  );
}
