import { CHANGELOG } from "@finance/core/changelog-entries";
import { nouveautesCopyFor } from "@/components/marketing/nouveautes-copy";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/og/og-card";

/** « Nouveautés »' link preview: the page's name, and the latest change. */
const copy = nouveautesCopyFor("fr");

export const alt = `Pluclair — ${copy.meta.title}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  const latest = CHANGELOG[0]!;
  return ogCard({
    kicker: copy.meta.title,
    title: latest.fr.title,
    subtitle: latest.fr.body,
  });
}
