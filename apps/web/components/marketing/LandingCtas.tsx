"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { landingCopyFor } from "@/components/marketing/landing-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { useLocale } from "@/lib/locale-context";

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
  "transition-all duration-hover [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] " +
  `${marketingFocus} ` +
  "active:scale-[0.98]";

/* `md` is the nav pill and asks for its height rather than deriving one from
   padding: at `py-2.5` it drew a 40px box, which is under the 44px a finger
   needs and it is the primary action on every marketing page. `lg` already
   clears the minimum on its padding alone. */
const sizes = {
  md: "min-h-11 px-5 text-sm",
  lg: "px-7 py-3.5 text-[0.95rem]",
} as const;

/* No glow. The `lg` button cast `0 8px 28px -12px rgba(224, 190, 122, 0.45)`
   under itself until DESIGN.md's Flat-With-One-Exception Rule was read as
   written: the only shadows this site is licensed to cast are the two in the
   glass vocabulary, under The Marketing Glass Rule, and a gold halo under a
   button is neither glass nor a recess — it is a lens flare, which is what it
   already looked like at nav size.

   Nothing is lost by it. The fill is Lamplit Gold, `--primary` at #e0be7a,
   which this file's note above measures at 11:1 on the near-black marketing
   ground; the other button in the pair is a 6%-white pane behind a hairline.
   Which of the two is the primary action was never the halo's work. */
const solid =
  "bg-primary text-primary-foreground hover:bg-primary-hover hover:-translate-y-0.5";

/* Glass, like every other translucent surface on the site: on the hero it
   sits over the orb's bloom, and the blur is what stops it reading as a hole
   punched in the light. */
const quiet =
  "border border-white/12 bg-white/[0.06] backdrop-blur-xl text-marketing-ink " +
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
  const copy = landingCopyFor(useLocale());
  if (isLoggedIn) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <Link href="/bearing" className={cn(base, sizes[size], solid)}>
          {layout === "solo" ? copy.cta.openApp : copy.cta.goToDashboard}
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Link href="/signup" className={cn(base, sizes[size], solid)}>
        {copy.cta.getStarted}
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
          {copy.cta.signIn}
        </Link>
      )}
    </div>
  );
}
