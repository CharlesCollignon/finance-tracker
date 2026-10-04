/* Hallmark · genre: atmospheric · macrostructure: Split Studio · theme: design.md (Pluclair) · enrichment: none · nav: kept · footer: kept */

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { AppScreen } from "@/components/marketing/AppScreen";
import { LandingBloom } from "@/components/marketing/LandingOrb";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { Reveal } from "@/components/marketing/LandingReveal";
import { getLocale, getT } from "@/lib/locale";
import {
  adjacentLandingPages,
  featureHref,
  getLandingPage,
  landingCopyFor,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

interface FeaturePageProps {
  pageId: LandingPageId;
  isLoggedIn: boolean;
}

/**
 * One screen of the app, explained: what it is for and its screen side by
 * side, as on the landing page's rows, then the three things you do on it.
 *
 * The steps carried 01–03 counters in a glass grid, and the screen sat in a
 * drawn browser with a drawn phone over it; the order of a list says the
 * order, and the screen says itself.
 */
export async function FeaturePage({ pageId, isLoggedIn }: FeaturePageProps) {
  const t = await getT();
  const locale = await getLocale();
  const page = getLandingPage(pageId, locale);
  const { prev, next } = adjacentLandingPages(pageId, locale);
  // "Previous" and "Next" sit in the copy file with the other marketing
  // words: nothing behind the login walks a reader through these pages in a
  // fixed order, so there is no app string to borrow.
  const { nav } = landingCopyFor(locale);

  return (
    // overflow-x-clip, not hidden: the bloom below is 36rem wide and centred,
    // so on a phone it reaches past the right edge and would drag the whole
    // document into horizontal scroll. `clip` contains it without making the
    // article a scroll container.
    <article className="relative isolate overflow-x-clip">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem]"
        aria-hidden
      >
        <div className="marketing-sparks absolute inset-0 opacity-70" />
      </div>
      <LandingBloom className="left-1/2 top-[16rem] h-[36rem] w-[36rem] -translate-x-1/2 opacity-35" />

      <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-32 md:pb-28 md:pt-40">
        <div className="grid items-center gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
          <div>
            <h1 className="marketing-display text-display-section">
              {page.title}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-marketing-muted md:text-lg">
              {page.utility}
            </p>
            <LandingCtas
              isLoggedIn={isLoggedIn}
              size="lg"
              layout="solo"
              className="mt-8"
            />
          </div>
          <Reveal delay={0.1}>
            <AppScreen pageId={pageId} />
          </Reveal>
        </div>

        <ol className="mt-20 grid gap-10 md:mt-28 md:grid-cols-3 md:gap-12">
          {page.steps.map((step) => (
            <li key={step.title}>
              <h2 className="font-head text-lg text-marketing-ink">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-marketing-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <nav
          className="mt-20 flex items-stretch justify-between gap-4 border-t border-white/10 pt-8"
          aria-label={t("common.nearbyPages")}
        >
          {prev ? (
            <Link
              href={featureHref(prev.id)}
              className={cn(
                "group flex min-w-0 flex-col items-start rounded-control py-1",
                marketingFocus,
              )}
            >
              <span className="flex items-center gap-1.5 text-sm text-marketing-faint">
                <ArrowLeft size={14} aria-hidden />
                {nav.previous}
              </span>
              <span className="mt-1 truncate font-head text-lg text-marketing-ink transition-colors duration-200 group-hover:text-marketing-muted motion-reduce:transition-none">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={featureHref(next.id)}
              className={cn(
                "group flex min-w-0 flex-col items-end rounded-control py-1 text-right",
                marketingFocus,
              )}
            >
              <span className="flex items-center gap-1.5 text-sm text-marketing-faint">
                {nav.next}
                <ArrowRight size={14} aria-hidden />
              </span>
              <span className="mt-1 truncate font-head text-lg text-marketing-ink transition-colors duration-200 group-hover:text-marketing-muted motion-reduce:transition-none">
                {next.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </article>
  );
}
