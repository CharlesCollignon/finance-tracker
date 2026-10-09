/* Hallmark · genre: atmospheric · macrostructure: Split Studio · theme: design.md (Pluclair) · enrichment: kept (WebGL Earth hero) · nav: kept · footer: kept */

import { AppleLogo, GooglePlayLogo } from "@phosphor-icons/react/dist/ssr";
import { getLocale } from "@/lib/locale";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { LandingEarth } from "@/components/marketing/LandingEarth";
import {
  FadeUp,
  HeroDepth,
  HeroDrift,
  Questions,
  RiseLines,
  RiseWords,
} from "@/components/marketing/LandingReveal";
import { landingCopyFor } from "@/components/marketing/landing-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { storeLinks } from "@/lib/store-links";
import { FeatureBento } from "@/components/marketing/landing/FeatureBento";
import { FigureSection } from "@/components/marketing/landing/FigureSection";
import { OrbFinale } from "@/components/marketing/landing/OrbFinale";
import { PhoneStory } from "@/components/marketing/landing/PhoneStory";
import { PromiseSection } from "@/components/marketing/landing/PromiseSection";
import { ScreenGallery } from "@/components/marketing/landing/ScreenGallery";
import { cn } from "@/lib/utils";

interface LandingPageProps {
  isLoggedIn: boolean;
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
 * It moves on one motif, things rising out of a horizon (`LandingReveal`):
 * the hero on a single timeline with the Earth's, headings rising word by
 * word, the promise lit as it is read, the screens landing as they are
 * scrolled to. What is not open to everyone yet is said once, under "Coming
 * soon", in the future tense.
 */
export async function LandingPage({ isLoggedIn }: LandingPageProps) {
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
  } = landingCopyFor(locale);
  // The phone app leaves « Bientôt » once a store has it.
  const stores = storeLinks();
  const inStores = [
    { href: stores.appStore, label: phone.appStore, Icon: AppleLogo },
    { href: stores.googlePlay, label: phone.googlePlay, Icon: GooglePlayLogo },
  ].filter((store): store is typeof store & { href: string } =>
    Boolean(store.href),
  );
  const comingSoon =
    inStores.length > 0
      ? soon.items.filter((item) => item.id !== "app")
      : soon.items;

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      {/* A film title card: the headline, the tagline and the buttons set low
          on the left, on the planet's dark body, leaving the sky, the sun and
          the black hole the top and the right. It was centred, everything
          stacked on one axis — the hero every generated page has. */}
      <section className="relative isolate flex min-h-dvh flex-col justify-end overflow-hidden px-6 pb-14 pt-28 md:pb-20">
        {/* The Earth from orbit, its rim arcing across the hero with Europe
            lit at dusk below it, under its own nebula and stars, a distant
            sun setting on the rim with the light in it. Still: the light
            does not follow the pointer here, so the scene is out of the
            pointer's way like the backgrounds elsewhere. The bottom fades
            into the page's ground, so the black of space does not end on a
            line. The surface at the renderer's ceiling (4, it was 3.5) and the
            light a touch up (1.65, it was 1.5), so the land under the rim
            reads a little brighter. */}
        <HeroDepth className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_78%,transparent)]">
          <LandingEarth
            surfaceBrightness={4}
            illumination={1.65}
            aurora={0.6}
            interactive={false}
          />
        </HeroDepth>

        {/* One timeline with the Earth's: the nav slides down, the
            headline's lines rise while the planet fades in, the tagline and
            the buttons follow, and as the sun starts up behind the rim a
            glint crosses the gold button. Scrolling away, the text drifts
            up and fades while the planet comes slowly closer. */}
        <HeroDrift className="relative z-20 mx-auto w-full max-w-6xl">
          <RiseLines
            lines={hero.titleLines}
            className="marketing-display text-display-hero"
            delay={0.35}
          />
          <FadeUp trigger="mount" delay={0.95}>
            <p className="mt-6 max-w-xl text-[0.975rem] leading-relaxed text-marketing-muted sm:text-lg">
              {hero.tagline}
            </p>
          </FadeUp>
          <FadeUp trigger="mount" delay={1.2}>
            <LandingCtas
              isLoggedIn={isLoggedIn}
              size="lg"
              shine
              className="mt-8"
            />
          </FadeUp>
        </HeroDrift>
      </section>

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
