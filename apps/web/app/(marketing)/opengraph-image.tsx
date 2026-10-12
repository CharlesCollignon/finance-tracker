import { landingCopyFor } from "@/components/marketing/landing-copy";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/og/og-card";

/** The landing's link preview: the hero's headline and the promise. */
const copy = landingCopyFor("fr");

export const alt = `Pluclair — ${copy.hero.titleLines.join(" ")}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    kicker: "Bêta ouverte",
    title: copy.hero.titleLines.join(" "),
    subtitle: copy.promise.text,
  });
}
