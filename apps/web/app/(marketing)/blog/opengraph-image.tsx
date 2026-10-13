import { blogCopyFor } from "@/components/marketing/blog-copy";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/og/og-card";

/** « Le blog »'s link preview. */
const copy = blogCopyFor("fr");

export const alt = `Pluclair — ${copy.meta.title}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    kicker: "Pluclair",
    title: copy.meta.title,
    subtitle: copy.hero.intro,
  });
}
