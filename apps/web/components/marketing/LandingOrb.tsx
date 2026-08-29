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
 * Three motions run at different periods so the loop never reads as a single
 * repeating cycle: the artwork turns, the whole orb drifts on a slow figure,
 * and a blurred copy behind it breathes. Because the periods do not divide
 * evenly, the combination takes minutes to repeat.
 *
 * All of it is CSS, so it costs nothing on the main thread and stops dead
 * under prefers-reduced-motion.
 */
export function LandingOrb({ className, size = 220 }: LandingOrbProps) {
  return (
    <div
      className={cn("landing-orb relative", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="landing-orb__glow absolute inset-0">
        <Image
          src="/logo-mark.png"
          alt=""
          width={size}
          height={size}
          priority
          className="h-full w-full blur-2xl"
        />
      </div>
      <div className="landing-orb__body absolute inset-0">
        <Image
          src="/logo-mark.png"
          alt=""
          width={size}
          height={size}
          priority
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
