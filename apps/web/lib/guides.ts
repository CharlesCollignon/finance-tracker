import type { MDXContent } from "mdx/types";
import { GUIDE_SLUGS, type GuideMeta, type GuideSlug } from "@/lib/guide-list";

/**
 * Loading a guide's text and details (`content/guides/<slug>.mdx`), on the
 * server. Apart from `guide-list.ts`, which only names the guides and their
 * addresses, so the site's client chrome can link to them without the MDX
 * coming along.
 */

export async function loadGuide(
  slug: GuideSlug,
): Promise<{ Content: MDXContent; meta: GuideMeta }> {
  const guide = (await import(`@/content/guides/${slug}.mdx`)) as {
    default: MDXContent;
    metadata: GuideMeta;
  };
  return { Content: guide.default, meta: guide.metadata };
}

/** Every guide's details, in the blog's order. */
export async function allGuides(): Promise<
  { slug: GuideSlug; meta: GuideMeta }[]
> {
  return Promise.all(
    GUIDE_SLUGS.map(async (slug) => ({
      slug,
      meta: (await loadGuide(slug)).meta,
    })),
  );
}
