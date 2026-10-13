/* Hallmark · genre: atmospheric · macrostructure: Long Document (a guide, with its contents held in the margin) · theme: design.md (Pluclair) · enrichment: the room's own light as a cover · nav: kept · footer: kept */

import Link from "next/link";
import { ArrowLeft, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { formatFullDate } from "@finance/core/constants";
import { getLocale } from "@/lib/locale";
import { feedbackEmail } from "@/lib/feedback-email";
import {
  BLOG_HREF,
  GUIDE_SLUGS,
  guideHref,
  type GuideSlug,
} from "@/lib/guide-list";
import { loadGuide } from "@/lib/guides";
import { getSiteUrl } from "@/lib/supabase/env";
import { blogCopyFor } from "@/components/marketing/blog-copy";
import { ElsewhereLink } from "@/components/marketing/ElsewhereLink";
import { FadeUp, RiseLines } from "@/components/marketing/LandingReveal";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { GuideCard } from "@/components/marketing/blog/GuideCard";
import { GuideCover } from "@/components/marketing/blog/GuideCover";
import { GuideToc } from "@/components/marketing/blog/GuideToc";
import { cn } from "@/lib/utils";

const BODY_ID = "guide-body";

/**
 * One guide, read: its title rising, the lede and how long it takes, its
 * cover, then the text at a reading measure with its contents held in the
 * margin beside it (`GuideToc`). It ends on what it is not — advice — on a
 * way to write in, and on the next guide.
 */
export async function GuideArticle({ slug }: { slug: GuideSlug }) {
  const locale = await getLocale();
  const copy = blogCopyFor(locale);
  const { Content, meta } = await loadGuide(slug);
  const nextSlug =
    GUIDE_SLUGS[(GUIDE_SLUGS.indexOf(slug) + 1) % GUIDE_SLUGS.length]!;
  const next = (await loadGuide(nextSlug)).meta;
  const email = feedbackEmail();

  // For search engines: what the page is, who wrote it, and when.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.published,
    dateModified: meta.updated,
    inLanguage: "fr-FR",
    url: new URL(guideHref(slug), getSiteUrl()).toString(),
    author: { "@type": "Person", name: "Charles Collignon" },
    publisher: { "@type": "Organization", name: "Pluclair" },
  };

  return (
    <article className="relative isolate overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <header className="relative px-6 pb-12 pt-32 md:pb-16 md:pt-44">
        <div className="mx-auto max-w-6xl">
          <FadeUp trigger="mount" delay={0.05}>
            <Link
              href={BLOG_HREF}
              className={cn(
                "group inline-flex min-h-11 items-center gap-2 rounded-full text-sm text-marketing-muted transition-colors duration-hover hover:text-white",
                marketingFocus,
              )}
            >
              <ArrowLeft
                size={14}
                aria-hidden
                className="transition-transform duration-hover group-hover:-translate-x-0.5"
              />
              {copy.allGuides}
            </Link>
          </FadeUp>
          <FadeUp trigger="mount" delay={0.15}>
            <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
              {copy.rubriques[meta.rubrique]} ·{" "}
              {copy.minutes.replace("{minutes}", String(meta.minutes))}
            </p>
          </FadeUp>
          <RiseLines
            lines={[meta.title]}
            className="marketing-display mt-4 max-w-4xl text-display-section"
            delay={0.25}
          />
          <FadeUp trigger="mount" delay={0.6}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-marketing-muted">
              {meta.description}
            </p>
            <p className="mt-4 text-sm text-marketing-faint">
              {copy.updated.replace(
                "{date}",
                formatFullDate(meta.updated, locale),
              )}
              {locale === "en" ? ` · ${copy.frenchOnly}` : ""}
            </p>
          </FadeUp>
        </div>
      </header>

      <FadeUp trigger="mount" delay={0.7} className="px-6">
        <GuideCover
          seed={meta.cover}
          className="mx-auto aspect-[16/9] max-w-6xl rounded-[2rem] md:aspect-[21/8]"
        />
      </FadeUp>

      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-16 md:grid-cols-[minmax(0,3fr)_minmax(0,8fr)] md:py-24">
        <div>
          <GuideToc label={copy.toc} bodyId={BODY_ID} />
        </div>
        <div id={BODY_ID} lang="fr" className="min-w-0 max-w-[40rem]">
          <Content />
          <p className="mt-14 text-sm text-marketing-muted">
            {copy.disclaimer}
          </p>
        </div>
      </div>

      <footer className="px-6 pb-28 md:pb-36">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          <GuideCard
            slug={nextSlug}
            meta={next}
            copy={copy}
            kicker={copy.next}
          />
          {email ? (
            <div className="flex flex-col justify-end gap-4">
              <h2 className="marketing-display text-display-sub">
                {copy.question.heading}
              </h2>
              <p className="max-w-md text-marketing-muted">
                {copy.question.body}
              </p>
              <ElsewhereLink
                href={`mailto:${email}?subject=${encodeURIComponent(meta.title)}`}
                title={copy.question.write}
                detail={email}
                icon={<EnvelopeSimple size={22} aria-hidden />}
              />
            </div>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
