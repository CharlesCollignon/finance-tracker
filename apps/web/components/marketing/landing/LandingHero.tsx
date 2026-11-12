import Link from "next/link";
import { Orb } from "@/components/brand/Orb";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { FadeUp, RiseLines } from "@/components/marketing/LandingReveal";
import {
  featureHref,
  type LandingPageId,
  type landingCopyFor,
} from "@/components/marketing/landing-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

type Copy = ReturnType<typeof landingCopyFor>;

/** The screens named along the hero's foot, in the app's order. */
const SCREENS: LandingPageId[] = [
  "bearing",
  "ledger",
  "charges",
  "wallets",
  "month-close",
];

interface LandingHeroProps {
  hero: Copy["hero"];
  pages: Copy["pages"];
  isLoggedIn: boolean;
  demo: boolean;
}

/**
 * The landing's first screen, kept to almost nothing: the headline and two
 * buttons on the left, the orb lit in the middle, three short lines on the
 * right, and the app's screens named along the foot, each leading to its
 * page.
 *
 * It replaced, in November 2026 at the owner's call, a film title card set
 * over a WebGL Earth at dusk — sky, sun, aurora, a black hole, the text
 * drifting away on scroll. The orb is the one lit thing now, the way a
 * figure is the one bright thing in the app: nothing moves but its own
 * slow weather. The tagline went to the page's description, the download
 * button to the footer and the phone section below, and « Nouveautés » to
 * the header.
 *
 * Below `md` it stacks, the orb first; from `md` the headline sits beside
 * the orb with the lines under it; from `xl` the three take a column each
 * (`.landing-hero-grid` in globals.css).
 */
export function LandingHero({
  hero,
  pages,
  isLoggedIn,
  demo,
}: LandingHeroProps) {
  const titleOf = (id: LandingPageId) =>
    pages.find((page) => page.id === id)?.title ?? id;

  return (
    <section className="relative flex min-h-dvh flex-col px-6 pt-24 md:pt-28">
      <div className="landing-hero-grid mx-auto w-full max-w-6xl flex-1 py-8 md:py-12">
        <div className="[grid-area:text]">
          <RiseLines
            lines={hero.titleLines}
            // The first line in the ink, the rest a step back.
            className="marketing-display text-display-hero md:whitespace-nowrap [&>span:not(:first-child)]:text-marketing-faint"
            delay={0.15}
          />
          <FadeUp trigger="mount" delay={0.55}>
            <LandingCtas
              isLoggedIn={isLoggedIn}
              size="lg"
              layout="hero"
              demo={demo}
              className="mt-9"
            />
          </FadeUp>
        </div>

        <FadeUp
          trigger="mount"
          delay={0.3}
          className="landing-hero-stage [grid-area:orb]"
        >
          <Orb size="clamp(8.5rem, 13vw, 11.5rem)" />
        </FadeUp>

        <FadeUp trigger="mount" delay={0.7} className="[grid-area:facts]">
          <ul className="grid gap-3.5 text-[0.95rem] text-marketing-ink">
            {hero.facts.map((fact) => (
              <li key={fact} className="flex items-baseline gap-3">
                <span
                  className="size-1.5 shrink-0 -translate-y-0.5 rounded-full bg-primary"
                  aria-hidden
                />
                {fact}
              </li>
            ))}
          </ul>
        </FadeUp>
      </div>

      <FadeUp trigger="mount" delay={0.85} className="mx-auto w-full max-w-6xl">
        <nav
          aria-label={hero.screens}
          className="flex flex-wrap justify-between gap-x-8 gap-y-3 border-t border-white/10 pb-8 pt-6 max-md:justify-start"
        >
          {SCREENS.map((id) => (
            <Link
              key={id}
              href={featureHref(id)}
              className={cn(
                "rounded-control text-base font-medium tracking-[-0.02em] text-marketing-faint transition-colors duration-hover hover:text-white md:text-lg",
                marketingFocus,
              )}
            >
              {titleOf(id)}
            </Link>
          ))}
        </nav>
      </FadeUp>
    </section>
  );
}
