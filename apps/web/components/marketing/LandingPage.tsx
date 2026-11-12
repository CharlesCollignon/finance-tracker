/* Hallmark · genre: atmospheric · macrostructure: Split Studio · theme: design.md (Pluclair) · enrichment: orb hero (minimal, Nov 2026) · nav: kept · footer: kept */

import Link from "next/link";
import {
  AndroidLogo,
  AppleLogo,
  GooglePlayLogo,
} from "@phosphor-icons/react/dist/ssr";
import { getLocale } from "@/lib/locale";
import {
  FadeUp,
  Questions,
  RiseWords,
} from "@/components/marketing/LandingReveal";
import { landingCopyFor } from "@/components/marketing/landing-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { openRoadmap } from "@/components/marketing/nouveautes/open-roadmap";
import { DOWNLOAD_HREF } from "@/components/marketing/download-copy";
import { storeLinks } from "@/lib/store-links";
import { FeatureBento } from "@/components/marketing/landing/FeatureBento";
import { LandingHero } from "@/components/marketing/landing/LandingHero";
import { FigureSection } from "@/components/marketing/landing/FigureSection";
import { OrbFinale } from "@/components/marketing/landing/OrbFinale";
import { PhoneStory } from "@/components/marketing/landing/PhoneStory";
import { PromiseSection } from "@/components/marketing/landing/PromiseSection";
import { ScreenGallery } from "@/components/marketing/landing/ScreenGallery";
import { cn } from "@/lib/utils";

interface LandingPageProps {
  isLoggedIn: boolean;
  /** A demo account is configured (`DEMO_EMAIL`, migration 081). */
  demo?: boolean;
}

/** Text a little narrower than its screen, on whichever side it falls. */
const SPLIT = "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";

/**
 * The landing page, as a run of questions a person actually asks, each beside
 * the screen that answers it.
 *
 * It had been a pillars row numbered 01–03, a drawn laptop and phone, seven
 * icon cards in a grid, two long essays with definition lists and four
 * numbered beats — written for someone already fluent in the product's
 * mechanics. Everyday readers bounce off that. The mechanisms are all still
 * here, each said in two or three plain sentences next to a picture of the
 * screen, with the feature page one press away for anyone who wants the rest.
 *
 * Below the hero it is told as the page is scrolled: the promise lit
 * word by word, « Il vous reste » put together, the month on a phone that
 * turns chapter by chapter, the desktop screens as a reel, the rest as an
 * uneven grid, and the orb rising at the end (`landing/`, and the Motion
 * section of DESIGN.md). What is not open to everyone yet is said once,
 * under "Coming soon", in the future tense.
 */
export async function LandingPage({
  isLoggedIn,
  demo = false,
}: LandingPageProps) {
  const locale = await getLocale();
  const {
    hero,
    promise,
    figure,
    story,
    gallery,
    more,
    soon,
    phone,
    faq,
    finalCta,
    pages,
  } = landingCopyFor(locale);
  // The phone app leaves « Bientôt » once a store has it, or the site hands
  // out its APK. The APK's buttons lead to its download page, which says how
  // to install it; Google Play, once it has the app, replaces it.
  const stores = storeLinks();
  const apk = stores.androidApk && !stores.googlePlay ? DOWNLOAD_HREF : null;
  const inStores = [
    { href: stores.appStore, label: phone.appStore, Icon: AppleLogo },
    { href: stores.googlePlay, label: phone.googlePlay, Icon: GooglePlayLogo },
    { href: apk, label: phone.androidApk, Icon: AndroidLogo },
  ].filter((store): store is typeof store & { href: string } =>
    Boolean(store.href),
  );
  // What is coming is Nouveautés' « Bientôt », so the two never disagree;
  // the phone app heads it until a store or the APK has it.
  const comingSoon = [
    ...(inStores.length > 0 ? [] : soon.items),
    ...openRoadmap().map((item) => ({ id: item.id, ...item[locale] })),
  ];

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <LandingHero
        hero={hero}
        pages={pages}
        isLoggedIn={isLoggedIn}
        demo={demo}
      />

      {/* --------------------------------------------------------- promise */}
      <PromiseSection text={promise.text} />

      {/* ---------------------------------------------------------- figure */}
      <FigureSection copy={figure} />

      {/* ----------------------------------------------------------- story */}
      <PhoneStory copy={story} />

      {/* --------------------------------------------------------- gallery */}
      <ScreenGallery copy={gallery} />

      {/* ------------------------------------------------------------ more */}
      <FeatureBento copy={more} />

      {/* ----------------------------------------------------------- phone */}
      {inStores.length > 0 ? (
        <section className="relative px-6 pb-28 md:pb-36">
          <div className={cn("mx-auto grid max-w-6xl gap-10 md:gap-14", SPLIT)}>
            <RiseWords
              text={phone.heading}
              className="marketing-display text-display-sub"
            />
            <FadeUp delay={0.1}>
              <p className="max-w-prose text-base leading-relaxed text-marketing-muted">
                {phone.body}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {inStores.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    rel="noopener"
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-5 text-sm font-medium text-marketing-ink backdrop-blur-xl",
                      "transition-[transform,background-color,border-color,color] duration-hover hover:border-white/25 hover:bg-white/[0.11] hover:text-white active:scale-[0.98]",
                      marketingFocus,
                    )}
                  >
                    <Icon size={18} weight="fill" aria-hidden />
                    {label}
                  </a>
                ))}
              </div>
              {apk ? (
                <p className="mt-4 text-sm leading-relaxed text-marketing-faint">
                  {phone.apkNote}{" "}
                  <Link
                    href={DOWNLOAD_HREF}
                    className={cn(
                      "rounded-control text-marketing-muted underline underline-offset-4 transition-colors duration-hover hover:text-white",
                      marketingFocus,
                    )}
                  >
                    {phone.apkHelp}
                  </Link>
                </p>
              ) : null}
            </FadeUp>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ soon */}
      {comingSoon.length > 0 ? (
        <section className="relative px-6 pb-28 md:pb-36">
          <div className={cn("mx-auto grid max-w-6xl gap-10 md:gap-14", SPLIT)}>
            <RiseWords
              text={soon.heading}
              className="marketing-display text-display-sub"
            />
            <ul className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {comingSoon.map((item, index) => (
                <li key={item.title}>
                  <FadeUp delay={0.1 + index * 0.08}>
                    <h3 className="font-head text-lg text-marketing-ink">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-marketing-muted">
                      {item.body}
                    </p>
                  </FadeUp>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------- questions */}
      {/* `#privacy`, which the header has always linked to: the questions
          are where what happens to the reader's data is now said. */}
      <section id="privacy" className="relative px-6 pb-28 md:pb-36">
        <div className={cn("mx-auto grid max-w-6xl gap-10 md:gap-14", SPLIT)}>
          <RiseWords
            text={faq.heading}
            className="marketing-display text-display-sub"
          />
          <FadeUp delay={0.15}>
            <Questions items={faq.items} />
          </FadeUp>
        </div>
      </section>

      {/* ------------------------------------------------------- final cta */}
      <OrbFinale copy={finalCta} isLoggedIn={isLoggedIn} />
    </>
  );
}
