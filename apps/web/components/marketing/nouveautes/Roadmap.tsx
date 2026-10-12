import type { RoadmapItem } from "@finance/core/changelog";
import {
  NO_TALLY,
  ROADMAP_VOTE,
  roadmapTarget,
  type ReactionTally,
} from "@finance/core/reactions";
import type { Locale } from "@finance/core/i18n/locale";
import { FadeUp, RiseWords } from "@/components/marketing/LandingReveal";
import {
  NOUVEAUTES_HREF,
  type NouveautesCopy,
} from "@/components/marketing/nouveautes-copy";
import { Reactions } from "@/components/marketing/nouveautes/Reactions";

/**
 * « Bientôt »: what is being built and not open yet, after everything that
 * is. Each item carries a hollow ring where a shipped entry has its dot —
 * not done yet, said the way Plan says a milestone ahead — and « J'attends
 * ça », for the owner to read what is awaited most. The order stays the
 * owner's; the votes do not sort it.
 */
export function Roadmap({
  items,
  copy,
  locale,
  tallies,
  signedIn,
}: {
  items: readonly RoadmapItem[];
  copy: NouveautesCopy;
  locale: Locale;
  /** The votes on each item, by `roadmap:<id>`. */
  tallies: Record<string, ReactionTally>;
  signedIn: boolean;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="relative px-6 pb-24 md:pb-32">
      <div className="mx-auto max-w-6xl">
        <RiseWords
          text={copy.soon.heading}
          className="marketing-display text-display-section"
        />
        <FadeUp delay={0.1}>
          <p className="mt-4 max-w-xl text-marketing-muted">
            {copy.soon.intro}
          </p>
        </FadeUp>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map((item, index) => (
            <li key={item.id} className="min-w-0">
              <FadeUp delay={0.1 + index * 0.08} className="h-full">
                <div className="glass-flat flex h-full flex-col rounded-[1.75rem] p-6">
                  <span
                    className="block size-3 rounded-full border border-dashed border-white/50"
                    aria-hidden
                  />
                  <h3 className="mt-5 font-head text-lg text-marketing-ink">
                    {item[locale].title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-marketing-muted">
                    {item[locale].body}
                  </p>
                  <div className="-ml-1 mt-5">
                    <Reactions
                      target={roadmapTarget(item.id)}
                      kinds={[ROADMAP_VOTE]}
                      initial={tallies[roadmapTarget(item.id)] ?? NO_TALLY}
                      copy={copy.reactions}
                      signedIn={signedIn}
                      loginHref={`/login?next=${encodeURIComponent(NOUVEAUTES_HREF)}`}
                      vote
                    />
                  </div>
                </div>
              </FadeUp>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
