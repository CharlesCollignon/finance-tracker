import type { Metadata } from "next";
import type { Locale } from "@finance/core/i18n/locale";

/**
 * What a public page tells search results and link previews: its title and
 * line, its one address (the language is a cookie, not a path), and the same
 * pair for Open Graph and X. The image itself is the page's own
 * `opengraph-image.tsx`, which Next adds to whatever is returned here.
 *
 * A page's `openGraph` replaces the root layout's whole, which is why every
 * field is set here rather than inherited.
 */
export function shareMetadata({
  title,
  description,
  path,
  canonical = path,
  locale,
}: {
  title: string;
  description: string;
  path: string;
  /**
   * The address search engines should keep, when it is not this one: one
   * Nouveautés entry is the whole list with that entry open, so it shares
   * as itself and is indexed as the list.
   */
  canonical?: string;
  locale: Locale;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "Pluclair",
      locale: locale === "fr" ? "fr_FR" : "en_GB",
      url: path,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
