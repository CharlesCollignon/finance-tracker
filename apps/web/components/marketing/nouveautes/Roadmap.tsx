import type { RoadmapItem } from "@finance/core/changelog";
import type { Locale } from "@finance/core/i18n/locale";
import { FadeUp, RiseWords } from "@/components/marketing/LandingReveal";
import type { NouveautesCopy } from "@/components/marketing/nouveautes-copy";

/**
 * « Bientôt »: what is being built and not open yet, after everything that
 * is. Each item carries a hollow ring where a shipped entry has its dot —
 * not done yet, said the way Plan says a milestone ahead.
 */
export function Roadmap({
  items,
  copy,
  locale,
}: {
  items: readonly RoadmapItem[];
  copy: NouveautesCopy;
  locale: Locale;
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
                <div className="glass-flat h-full rounded-[1.75rem] p-6">
                  <span
                    className="block size-3 rounded-full border border-dashed border-white/50"
                    aria-hidden
                  />
                  <h3 className="mt-5 font-head text-lg text-marketing-ink">
                    {item[locale].title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-marketing-muted">
                    {item[locale].body}
                  </p>
                </div>
              </FadeUp>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
