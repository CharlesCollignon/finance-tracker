import { blogCopyFor } from "@/components/marketing/blog-copy";
import { isGuideSlug } from "@/lib/guide-list";
import { loadGuide } from "@/lib/guides";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/og/og-card";

/** A guide's link preview: « Le blog · Votre mois », its title, its lede. */
export const alt = "Pluclair — Le blog";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const copy = blogCopyFor("fr");
  if (!isGuideSlug(slug)) {
    return ogCard({ kicker: "Pluclair", title: copy.meta.title });
  }
  const { meta } = await loadGuide(slug);
  return ogCard({
    kicker: `${copy.meta.title} · ${copy.rubriques[meta.rubrique]}`,
    title: meta.title,
    subtitle: meta.description,
  });
}
