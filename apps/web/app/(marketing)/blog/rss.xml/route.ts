import { blogCopyFor } from "@/components/marketing/blog-copy";
import { rssFeed } from "@/lib/feed/rss";
import { BLOG_HREF, BLOG_RSS_HREF, guideHref } from "@/lib/guide-list";
import { allGuides } from "@/lib/guides";
import { getSiteUrl } from "@/lib/supabase/env";

/** « Le blog »'s guides as an RSS feed, newest first, in French. */
export const dynamic = "force-static";

export async function GET() {
  const base = getSiteUrl();
  const at = (path: string) => new URL(path, base).toString();
  const copy = blogCopyFor("fr");
  const guides = (await allGuides()).sort((a, b) =>
    b.meta.published.localeCompare(a.meta.published),
  );
  const xml = rssFeed({
    title: `${copy.meta.title} — Pluclair`,
    link: at(BLOG_HREF),
    self: at(BLOG_RSS_HREF),
    description: copy.meta.description,
    language: "fr-FR",
    items: guides.map((guide) => ({
      title: guide.meta.title,
      link: at(guideHref(guide.slug)),
      description: guide.meta.description,
      date: guide.meta.published,
    })),
  });
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
