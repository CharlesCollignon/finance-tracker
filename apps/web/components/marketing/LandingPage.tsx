/* Hallmark · genre: atmospheric · macrostructure: Split Studio · theme: design.md (Pluclair) · enrichment: kept (WebGL Earth hero) · nav: kept · footer: kept */

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getLocale } from "@/lib/locale";
import { AppScreen } from "@/components/marketing/AppScreen";
import { LandingBloom } from "@/components/marketing/LandingOrb";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { LandingEarth } from "@/components/marketing/LandingEarth";
import {
  FadeUp,
  HeroDepth,
  HeroDrift,
  Land,
  Questions,
  RiseLines,
  RiseWords,
  ScrollWords,
} from "@/components/marketing/LandingReveal";
import {
  featureHref,
  landingCopyFor,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

interface LandingPageProps {
  isLoggedIn: boolean;
}

/**
 * The screens "How it works" walks through, in the order a month uses them:
 * where you stand, what repeats, what slipped through, how long you could
 * hold out, what the investments are made of, and the read that puts it into
 * words. The ledger and the feature pages' walk keep all seven; these are the
 * six a first visit needs.
 */
const HOW_ORDER = [
  "bearing",
  "charges",
  "month-close",
  "plan",
  "wallets",
  "month-read",
] as const satisfies readonly LandingPageId[];

/** Text a little narrower than its screen, on whichever side it falls. */
const SPLIT = "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";
const SPLIT_FLIPPED = "md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]";

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
  const { hero, promise, how, soon, faq, finalCta } = landingCopyFor(locale);

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
      {/* The three commitments as one sentence, set large and left: a thing
          the reader is told, not a row of cards to scan. */}
      <section className="relative px-6 py-20 md:py-28">
        <ScrollWords
          text={promise.text}
          className="marketing-display mx-auto max-w-5xl text-balance text-display-sub text-marketing-ink"
        />
      </section>

      {/* ------------------------------------------------------------- how */}
      <section
        id="how"
        className="relative overflow-x-clip px-6 pb-28 md:pb-40"
      >
        <div className="mx-auto max-w-6xl">
          <RiseWords
            text={how.heading}
            className="marketing-display text-display-section"
          />
          <div className="mt-14 flex flex-col gap-24 md:mt-20 md:gap-36">
            {HOW_ORDER.map((id, index) => {
              const row = how.rows[id];
              // Alternating sides, so the eye walks down the page rather
              // than down one column.
              const flipped = index % 2 === 1;
              return (
                <article
                  key={id}
                  className={cn(
                    "grid items-center gap-10 md:gap-14",
                    flipped ? SPLIT_FLIPPED : SPLIT,
                  )}
                >
                  <div className={flipped ? "md:order-2" : undefined}>
                    <RiseWords
                      as="h3"
                      text={row.question}
                      className="marketing-display text-display-sub"
                    />
                    <FadeUp delay={0.2}>
                      <p className="mt-4 max-w-md text-base leading-relaxed text-marketing-muted">
                        {row.body}
                      </p>
                      <Link
                        href={featureHref(id)}
                        className={cn(
                          "group mt-7 inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-marketing-ink transition-colors duration-200 hover:border-white/30 hover:bg-white/[0.06] motion-reduce:transition-none",
                          marketingFocus,
                        )}
                      >
                        {row.link}
                        {/* It leans toward where it leads. */}
                        <ArrowRight
                          size={14}
                          aria-hidden
                          className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                        />
                      </Link>
                    </FadeUp>
                  </div>
                  <Land className={flipped ? "md:order-1" : undefined}>
                    <AppScreen pageId={id} />
                  </Land>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ soon */}
      <section className="relative px-6 pb-28 md:pb-36">
        <div className={cn("mx-auto grid max-w-6xl gap-10 md:gap-14", SPLIT)}>
          <RiseWords
            text={soon.heading}
            className="marketing-display text-display-sub"
          />
          <ul className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {soon.items.map((item, index) => (
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
      <section className="relative isolate overflow-hidden px-6 pb-28 pt-8 md:pb-40">
        <LandingBloom className="left-1/2 top-[38%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 opacity-60" />
        <div
          className="marketing-sparks pointer-events-none absolute inset-0 opacity-60"
          aria-hidden
        />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <RiseWords
            text={finalCta.heading}
            className="marketing-display text-display-section"
          />
          <FadeUp delay={0.3} className="flex flex-col items-center">
            <p className="mt-5 max-w-md text-base leading-relaxed text-marketing-muted">
              {finalCta.body}
            </p>
            <LandingCtas
              isLoggedIn={isLoggedIn}
              size="lg"
              className="mt-9 justify-center"
            />
          </FadeUp>
        </div>
      </section>
    </>
  );
}
