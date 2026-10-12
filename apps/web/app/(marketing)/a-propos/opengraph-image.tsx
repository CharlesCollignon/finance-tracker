import { aboutCopyFor } from "@/components/marketing/about-copy";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/og/og-card";

/** The about page's link preview: its greeting and who is writing. */
const copy = aboutCopyFor("fr");

export const alt = `Pluclair — ${copy.meta.title}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    kicker: copy.meta.title,
    title: copy.hero.titleLines.join(" "),
    subtitle: copy.hero.intro,
  });
}
