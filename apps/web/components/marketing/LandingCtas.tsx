import Link from "next/link";
import { cn } from "@/lib/utils";
import { landingCopy } from "@/components/marketing/landing-copy";

/**
 * The signup pair, in the three places it appears.
 *
 * A logged-in visitor gets one button into the app instead: offering "get
 * started" to someone with an account already is the small tell that a
 * marketing page was never wired to the product behind it.
 *
 * Deliberately not the app's `buttonVariants`. Those are tuned for the paper
 * ground, where a gold fill is 1.9:1 and needs `--primary-rim` to keep an
 * edge at all. Here the ground is near-black, gold sits at 11:1, and the rim
 * would only add a line the design does not want.
 */

const base =
  "inline-flex items-center justify-center rounded-full font-medium " +
  "transition-all duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--marketing-ground)] " +
  "active:scale-[0.98]";

const sizes = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-[0.95rem]",
} as const;

/** The glow is a hero affordance. At nav size it reads as a lens flare
 * hanging off the pill, so only `lg` carries it. */
const solid =
  "bg-primary text-primary-foreground hover:bg-primary-hover hover:-translate-y-0.5";

const solidGlow = "shadow-[0_8px_28px_-12px_rgba(224,190,122,0.45)]";

/* Glass, like every other translucent surface on the site: on the hero it
   sits over the orb's bloom, and the blur is what stops it reading as a hole
   punched in the light. */
const quiet =
  "border border-white/12 bg-white/[0.06] backdrop-blur-xl text-white/85 " +
  "hover:border-white/25 hover:bg-white/[0.11] hover:text-white";

interface LandingCtasProps {
  isLoggedIn: boolean;
  size?: keyof typeof sizes;
  /**
   * `solo` drops the secondary link, for spots with one clear next step.
   * `pair-compact` keeps it but hides it on the narrowest screens — the nav
   * pill cannot hold two buttons and a menu trigger at phone width, and of
   * the three the menu trigger is the one that must survive.
   */
  layout?: "pair" | "pair-compact" | "solo";
  className?: string;
}

export function LandingCtas({
  isLoggedIn,
  size = "md",
  layout = "pair",
  className,
}: LandingCtasProps) {
  if (isLoggedIn) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <Link
          href="/dashboard"
          className={cn(base, sizes[size], solid, size === "lg" && solidGlow)}
        >
          {layout === "solo"
            ? landingCopy.cta.openApp
            : landingCopy.cta.goToDashboard}
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Link
        href="/signup"
        className={cn(base, sizes[size], solid, size === "lg" && solidGlow)}
      >
        {landingCopy.cta.getStarted}
      </Link>
      {layout === "solo" ? null : (
        <Link
          href="/login"
          className={cn(
            base,
            sizes[size],
            quiet,
            layout === "pair-compact" && "max-sm:hidden",
          )}
        >
          {landingCopy.cta.signIn}
        </Link>
      )}
    </div>
  );
}
