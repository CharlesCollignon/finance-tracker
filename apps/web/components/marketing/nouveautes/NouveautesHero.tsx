import { FadeUp, RiseLines } from "@/components/marketing/LandingReveal";
import { LiveStatus } from "@/components/marketing/LiveStatus";
import type { NouveautesCopy } from "@/components/marketing/nouveautes-copy";
import { HeroFigures } from "@/components/marketing/nouveautes/HeroFigures";
import {
  WeekPulse,
  type PulseWeek,
} from "@/components/marketing/nouveautes/WeekPulse";

/**
 * The page opens on its name rising out of its mask, the live dot saying
 * when the list last changed, a line on what it is, and two figures counting
 * up. Beside them, the rhythm of the work — one bar a week — growing up from
 * its baseline (`WeekPulse`). Under it on a phone.
 */
export function NouveautesHero({
  copy,
  updated,
  figures,
  weeks,
  locale,
}: {
  copy: NouveautesCopy;
  updated: string;
  figures: { value: number; label: string }[];
  weeks: PulseWeek[];
  locale: string;
}) {
  return (
    <section className="relative isolate overflow-x-clip px-6 pb-16 pt-32 md:pb-24 md:pt-44">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem]"
        aria-hidden
      >
        <div className="marketing-sparks absolute inset-0 opacity-60" />
      </div>
      <div className="mx-auto grid max-w-6xl items-end gap-14 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-16">
        <div className="min-w-0">
          <FadeUp trigger="mount" delay={0.1}>
            <LiveStatus label={updated} />
          </FadeUp>
          <RiseLines
            lines={copy.hero.titleLines}
            className="marketing-display mt-8 text-display-hero"
            delay={0.25}
          />
          <FadeUp trigger="mount" delay={0.6}>
            <p className="mt-6 max-w-xl text-[0.975rem] leading-relaxed text-marketing-muted sm:text-lg">
              {copy.hero.intro}
            </p>
          </FadeUp>
          <FadeUp trigger="mount" delay={0.75}>
            <HeroFigures figures={figures} locale={locale} />
          </FadeUp>
        </div>
        <FadeUp trigger="mount" delay={0.5} className="min-w-0">
          <WeekPulse weeks={weeks} caption={copy.pulse.caption} />
        </FadeUp>
      </div>
    </section>
  );
}
