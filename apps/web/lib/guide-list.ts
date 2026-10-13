/**
 * « Le blog »'s guides: MDX files in `content/guides/`, each exporting its
 * `metadata` (`GuideMeta`), listed here in the order the blog shows them —
 * the first is the one « À la une ». French only, as decided with the owner
 * (2026-10-12): an English reader is told so above the text.
 *
 * Every guide explains and never advises (PRODUCT.md, commitment 3), and
 * every legal figure in one is sourced and dated (`<Sources>`).
 */
export const GUIDE_SLUGS = [
  "pea-cto-assurance-vie-per",
  "bilan-du-mois",
  "jour-de-lecture",
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export type GuideRubrique = "mois" | "placements";

export interface GuideMeta {
  title: string;
  /** The lede under the title, and what search results show. */
  description: string;
  rubrique: GuideRubrique;
  /** ISO dates. */
  published: string;
  updated: string;
  /** Minutes to read, checked against the text by `guides.test.ts`. */
  minutes: number;
}

export const BLOG_HREF = "/blog";
export const BLOG_RSS_HREF = `${BLOG_HREF}/rss.xml`;

export function guideHref(slug: GuideSlug): string {
  return `${BLOG_HREF}/${slug}`;
}

export function isGuideSlug(slug: string): slug is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(slug);
}
