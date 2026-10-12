import type { MetadataRoute } from "next";
import { ABOUT_HREF } from "@/components/marketing/about-copy";
import { featureHref, landingCopy } from "@/components/marketing/landing-copy";
import { legalPagesVisible } from "@/components/marketing/legal-status";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * The public pages, for search engines: the marketing site and nothing
 * behind the login. One URL per page, whatever the reader's language, because
 * the language is a cookie and not a path (`lib/locale.ts`).
 *
 * The legal pages are listed only where they are served: in production they
 * answer 404 until `LEGAL_DRAFT` is lifted.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const paths = [
    "/",
    ABOUT_HREF,
    ...landingCopy.pages.map((page) => featureHref(page.id)),
    ...(legalPagesVisible() ? ["/privacy", "/terms", "/mentions-legales"] : []),
  ];
  return paths.map((path) => ({
    url: new URL(path, base).toString(),
    priority: path === "/" ? 1 : 0.7,
  }));
}
