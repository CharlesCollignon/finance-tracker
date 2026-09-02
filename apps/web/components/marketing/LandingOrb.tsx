import Image from "next/image";
import { cn } from "@/lib/utils";

interface LandingOrbProps {
  className?: string;
  /** Rendered pixel size of the orb. */
  size?: number;
}

/**
 * The hero orb.
 *
 * The artwork now carries its own motion: inside the SVG, the body gradient
 * and the specular highlight drift on a slow loop, so the sphere reads as
 * being lit rather than drawn. That is also why it no longer rotates — the
 * light source is fixed, and spinning it would send the highlight orbiting,
 * which looks like a bug rather than a shine.
 *
 * Loaded as an image rather than inlined, so its animation and its
 * prefers-reduced-motion guard stay sealed inside the file. `unoptimized`
 * because the optimizer refuses SVG by default and has nothing to add to two
 * kilobytes of gradients anyway.
 */
export function LandingOrb({ className, size = 220 }: LandingOrbProps) {
  return (
    <div
      className={cn("relative", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* A radial wash rather than a blurred copy of the orb: blurring a
          square image leaves a faint boxy edge where the blur runs out. */}
      <div
        className="absolute -inset-1/4 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--primary) 38%, transparent) 0%, transparent 62%)",
        }}
      />
      <Image
        src="/pluclair-orb.svg"
        alt=""
        width={size}
        height={size}
        priority
        unoptimized
        className="relative h-full w-full"
      />
    </div>
  );
}
