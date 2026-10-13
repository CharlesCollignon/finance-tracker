import type { MetadataRoute } from "next";
import { ENTRAIDE_HREF } from "@finance/core/entraide";
import { ABOUT_HREF } from "@/components/marketing/about-copy";
import { featureHref, landingCopy } from "@/components/marketing/landing-copy";
import {
  entraideRulesVisible,
  legalPagesVisible,
} from "@/components/marketing/legal-status";
import { NOUVEAUTES_HREF } from "@/components/marketing/nouveautes-copy";
import { BLOG_HREF, GUIDE_SLUGS, guideHref } from "@/lib/guide-list";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * The public pages, for search engines: the marketing site and nothing
 * behind the login. One URL per page, whatever the reader's language, because
 * the language is a cookie and not a path (`lib/locale.ts`).
 *
 * The legal pages, and Entraide with its rules, are listed only where they
 * are served (`LEGAL_DRAFT`, `ENTRAIDE_RULES_DRAFT`). Entraide's threads are
 * found from its list. A Nouveautés entry's own address
 * is not listed: it is the list with that entry open, and says so with its
 * canonical link.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const paths = [
    "/",
    ABOUT_HREF,
    NOUVEAUTES_HREF,
    BLOG_HREF,
    ...GUIDE_SLUGS.map(guideHref),
    ...landingCopy.pages.map((page) => featureHref(page.id)),
    ...(legalPagesVisible() ? ["/privacy", "/terms", "/mentions-legales"] : []),
    ...(entraideRulesVisible()
      ? [ENTRAIDE_HREF, `${ENTRAIDE_HREF}/regles`]
      : []),
  ];
  return paths.map((path) => ({
    url: new URL(path, base).toString(),
    priority: path === "/" ? 1 : 0.7,
  }));
}
