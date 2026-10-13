/* Hallmark · genre: atmospheric · macrostructure: Ecosystem Index (featured, then the rest, then what is coming) · theme: design.md (Pluclair) · enrichment: the room's own light as covers · nav: kept · footer: kept */

import { NO_TALLY, ROADMAP_VOTE, roadmapTarget } from "@finance/core/reactions";
import { readReactions } from "@finance/data/reactions";
import { getAuthUser } from "@/lib/auth/get-user";
import { BLOG_HREF } from "@/lib/guide-list";
import { allGuides } from "@/lib/guides";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { blogCopyFor } from "@/components/marketing/blog-copy";
import { FadeUp, RiseLines } from "@/components/marketing/LandingReveal";
import { nouveautesCopyFor } from "@/components/marketing/nouveautes-copy";
import { GuideCard } from "@/components/marketing/blog/GuideCard";
import { openRoadmap } from "@/components/marketing/nouveautes/open-roadmap";
import { Reactions } from "@/components/marketing/nouveautes/Reactions";

/**
 * « Le blog »: the guide « À la une » drawn wide, the others under it, and
 * the door to Entraide while it is still coming — with « J'attends ça »,
 * the same vote as on « Nouveautés », so its count is one.
 */
export async function BlogIndex() {
  const locale = await getLocale();
  const copy = blogCopyFor(locale);
  const [featured, ...rest] = await allGuides();
  const entraide = openRoadmap().find((item) => item.id === "entraide");
  const user = await getAuthUser();
  const tally = entraide
    ? await createClient()
        .then((db) =>
          readReactions(db, [roadmapTarget(entraide.id)], user?.id ?? null),
        )
        .then((read) => read.get(roadmapTarget(entraide.id)) ?? NO_TALLY)
        .catch(() => NO_TALLY)
    : NO_TALLY;

  return (
    <div className="relative isolate overflow-x-clip">
      <section className="relative px-6 pb-14 pt-32 md:pb-20 md:pt-44">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem]"
          aria-hidden
        >
          <div className="marketing-sparks absolute inset-0 opacity-60" />
        </div>
        <div className="mx-auto max-w-6xl">
          <RiseLines
            lines={copy.hero.titleLines}
            className="marketing-display text-display-hero"
            delay={0.2}
          />
          <FadeUp trigger="mount" delay={0.55}>
            <p className="mt-6 max-w-xl text-[0.975rem] leading-relaxed text-marketing-muted sm:text-lg">
              {copy.hero.intro}
            </p>
          </FadeUp>
        </div>
      </section>

      <section aria-label={copy.meta.title} className="px-6 pb-24 md:pb-32">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          {featured ? (
            <FadeUp trigger="mount" delay={0.7}>
              <GuideCard
                slug={featured.slug}
                meta={featured.meta}
                copy={copy}
                wide
                kicker={copy.featured}
              />
            </FadeUp>
          ) : null}
          <ul className="grid gap-4 md:grid-cols-2">
            {rest.map((guide, index) => (
              <li key={guide.slug} className="min-w-0">
                <FadeUp delay={0.08 * index} className="h-full">
                  <GuideCard slug={guide.slug} meta={guide.meta} copy={copy} />
                </FadeUp>
              </li>
            ))}
          </ul>

          {entraide ? (
            <FadeUp>
              <div className="glass-flat mt-8 flex flex-col gap-5 rounded-[2rem] p-6 md:flex-row md:items-end md:justify-between md:p-8">
                <div className="max-w-xl">
                  <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
                    <span
                      className="block size-3 rounded-full border border-dashed border-white/50"
                      aria-hidden
                    />
                    {copy.entraide.soon}
                  </p>
                  <h2 className="mt-3 font-head text-2xl text-marketing-ink">
                    {copy.entraide.title}
                  </h2>
                  <p className="mt-2 text-marketing-muted">
                    {copy.entraide.body}
                  </p>
                </div>
                <Reactions
                  target={roadmapTarget(entraide.id)}
                  kinds={[ROADMAP_VOTE]}
                  initial={tally}
                  copy={nouveautesCopyFor(locale).reactions}
                  signedIn={Boolean(user)}
                  loginHref={`/login?next=${encodeURIComponent(BLOG_HREF)}`}
                  vote
                />
              </div>
            </FadeUp>
          ) : null}
        </div>
      </section>
    </div>
  );
}
