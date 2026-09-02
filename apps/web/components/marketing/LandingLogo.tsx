import Image from "next/image";
import { cn } from "@/lib/utils";

interface LandingLogoProps {
  className?: string;
  /** Rendered pixel size of the plate. */
  size?: number;
}

/**
 * The full logo, at hero size.
 *
 * The composition ships with its cream ground baked in — there is no
 * transparent export — so it cannot float on the page the way the bare orb
 * could. Clipping it to a rounded plate turns that constraint into the
 * treatment: the logo on its own ground, which is what the app icon is.
 *
 * A slow float keeps the hero from going inert now that the artwork itself is
 * a still image, and stops under prefers-reduced-motion.
 */
export function LandingLogo({ className, size = 240 }: LandingLogoProps) {
  return (
    <div
      className={cn("landing-logo relative", className)}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute -inset-1/4 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--primary) 26%, transparent) 0%, transparent 62%)",
        }}
        aria-hidden
      />
      <Image
        src="/logo-full.png"
        alt="Pluclair"
        width={size}
        height={size}
        priority
        className="relative h-full w-full rounded-[22%] shadow-lg"
      />
    </div>
  );
}
