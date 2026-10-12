"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { landingCopyFor } from "@/components/marketing/landing-copy";
import {
  CTA_BASE as base,
  CTA_QUIET as quiet,
  CTA_SIZES as sizes,
  CTA_SOLID as solid,
} from "@/components/marketing/cta-classes";
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
 * edge at all. Here the ground is near-black, gold sits at 10:1, and the rim
 * would only add a line the design does not want.
 */

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
  /** A glint of light across the gold button, once: the hero's sunrise. */
  shine?: boolean;
  /**
   * The secondary link folded away, for the nav pill once it has tightened
   * on scroll: it narrows and fades rather than leaving the row at once.
   */
  foldSecondary?: boolean;
  className?: string;
}

export function LandingCtas({
  isLoggedIn,
  size = "md",
  layout = "pair",
  shine = false,
  foldSecondary = false,
  className,
}: LandingCtasProps) {
  const gold = cn(solid, shine && "marketing-cta-shine");
  const copy = landingCopyFor(useLocale());
  if (isLoggedIn) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <Link href="/bearing" className={cn(base, sizes[size], gold)}>
          {layout === "solo" ? copy.cta.openApp : copy.cta.goToDashboard}
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Link href="/signup" className={cn(base, sizes[size], gold)}>
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
            "overflow-hidden whitespace-nowrap transition-[max-width,opacity,padding,margin,transform,background-color,border-color,color] duration-500",
            foldSecondary
              ? "pointer-events-none -ml-3 max-w-0 border-transparent px-0 opacity-0"
              : "max-w-48",
          )}
        >
          {copy.cta.signIn}
        </Link>
      )}
    </div>
  );
}
