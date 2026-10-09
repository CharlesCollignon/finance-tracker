/* Hallmark · genre: atmospheric · macrostructure: Split Studio · theme: design.md (Pluclair) · enrichment: per-page demo · nav: kept · footer: kept */

import { LandingBloom } from "@/components/marketing/LandingOrb";
import { getLocale, getT } from "@/lib/locale";
import {
  adjacentLandingPages,
  getLandingPage,
  landingCopyFor,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { EnvelopeDeck } from "@/components/marketing/feature/EnvelopeDeck";
import { FeatureDemo } from "@/components/marketing/feature/FeatureDemo";
import {
  FeatureHero,
  type HeroVariant,
} from "@/components/marketing/feature/FeatureHero";
import { PageNav } from "@/components/marketing/feature/PageNav";
import { StepStack } from "@/components/marketing/feature/StepStack";

interface FeaturePageProps {
  pageId: LandingPageId;
  isLoggedIn: boolean;
}

/**
 * How each page opens, alternating along the menu's order so no two
 * neighbours open alike; Questions, made for the phone, opens on one.
 */
const HERO: Record<LandingPageId, HeroVariant> = {
  bearing: "tilt",
  ledger: "stage",
  charges: "tilt",
  plan: "stage",
  wallets: "tilt",
  property: "stage",
  "month-close": "tilt",
  "month-read": "stage",
  questions: "phone",
  together: "tilt",
};

/**
 * One screen of the app, explained and played: it opens on the screen (one
 * of three stagings, `HERO`), then a demo of its one idea to try by hand —
 * different on every page (`feature/demos/`) — then the three things you do
 * on it as cards laid one on another, and the pages either side as cards to
 * lean into.
 */
export async function FeaturePage({ pageId, isLoggedIn }: FeaturePageProps) {
  const t = await getT();
  const locale = await getLocale();
  const page = getLandingPage(pageId, locale);
  const { prev, next } = adjacentLandingPages(pageId, locale);
  const { nav } = landingCopyFor(locale);

  return (
    // overflow-x-clip, not hidden: the bloom reaches past a phone's edge,
    // and `clip` contains it without making the article a scroll container
    // — which would also stop the steps from pinning.
    <article className="relative isolate overflow-x-clip">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem]"
        aria-hidden
      >
        <div className="marketing-sparks absolute inset-0 opacity-70" />
      </div>
      <LandingBloom className="left-1/2 top-[16rem] h-[36rem] w-[36rem] -translate-x-1/2 opacity-35" />

      <FeatureHero
        pageId={pageId}
        variant={HERO[pageId]}
        title={page.title}
        utility={page.utility}
        isLoggedIn={isLoggedIn}
      />
      {/* Placements is five envelopes with five sets of rules, and the
          page shows them before it opens one fund. */}
      {pageId === "wallets" ? <EnvelopeDeck /> : null}
      <FeatureDemo pageId={pageId} />
      <div className="mt-8 md:mt-16">
        <StepStack steps={page.steps} />
      </div>
      <PageNav
        prev={prev}
        next={next}
        labels={{ previous: nav.previous, next: nav.next }}
        ariaLabel={t("common.nearbyPages")}
      />
    </article>
  );
}
