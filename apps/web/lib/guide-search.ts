import { foldAccents } from "@finance/core/entraide";
import type { GuideMeta, GuideSlug } from "@/lib/guide-list";

// Words too common in a French question to say what it is about.
const STOP = new Set(
  "a au aux avec ce ces comment dans de des du elle en est et il je la le les leur ma mais me mes mon ne on ou par pas pour qu que quel quelle qui sa se son sur ta te tes ton tu un une vos votre vous y faut faire quoi est-ce".split(
    " ",
  ),
);

function words(text: string): string[] {
  return foldAccents(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

/**
 * The guides a question being typed is about, for « Déjà demandé ? »: those
 * sharing at least two of its words with their title and lede, the closest
 * first. Three guides need nothing cleverer.
 */
export function matchGuides(
  query: string,
  guides: readonly { slug: GuideSlug; meta: GuideMeta }[],
  limit = 2,
): { slug: GuideSlug; title: string }[] {
  const asked = new Set(words(query));
  if (asked.size === 0) {
    return [];
  }
  return guides
    .map((guide) => {
      const theirs = new Set(
        words(`${guide.meta.title} ${guide.meta.description}`),
      );
      let shared = 0;
      for (const word of asked) {
        if (theirs.has(word)) {
          shared++;
        }
      }
      return { slug: guide.slug, title: guide.meta.title, shared };
    })
    .filter((guide) => guide.shared >= 2)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map(({ slug, title }) => ({ slug, title }));
}
