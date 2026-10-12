import { CHANGELOG } from "@finance/core/changelog-entries";
import { DEFAULT_LOCALE } from "@finance/core/i18n/locale";
import {
  NOUVEAUTES_HREF,
  NOUVEAUTES_RSS_HREF,
  nouveautesCopyFor,
  nouveautesEntryHref,
} from "@/components/marketing/nouveautes-copy";
import { rssFeed } from "@/lib/feed/rss";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * « Nouveautés » as an RSS feed, in French: a feed reader carries no
 * language cookie, and French is the site's first language. Built once, at
 * build, from the entries in `@finance/core/changelog-entries`.
 */
export const dynamic = "force-static";

export function GET() {
  const base = getSiteUrl();
  const at = (path: string) => new URL(path, base).toString();
  const copy = nouveautesCopyFor(DEFAULT_LOCALE);
  const xml = rssFeed({
    title: `${copy.meta.title} — Pluclair`,
    link: at(NOUVEAUTES_HREF),
    self: at(NOUVEAUTES_RSS_HREF),
    description: copy.meta.description,
    language: "fr-FR",
    items: CHANGELOG.map((entry) => ({
      title: entry.fr.title,
      link: at(nouveautesEntryHref(entry.id)),
      description: entry.fr.body,
      date: entry.date,
    })),
  });
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
