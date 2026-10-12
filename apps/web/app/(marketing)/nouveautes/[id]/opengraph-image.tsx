import { CHANGELOG } from "@finance/core/changelog-entries";
import { formatFullDate } from "@finance/core/constants";
import { nouveautesCopyFor } from "@/components/marketing/nouveautes-copy";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/og/og-card";

/** One change's link preview: what kind, when, and what changed. */
export const alt = "Pluclair — Nouveautés";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const copy = nouveautesCopyFor("fr");
  const entry = CHANGELOG.find((candidate) => candidate.id === id);
  if (!entry) {
    return ogCard({ kicker: "Pluclair", title: copy.meta.title });
  }
  return ogCard({
    kicker: `${copy.filters.kinds[entry.kind]} · ${formatFullDate(entry.date, "fr")}`,
    title: entry.fr.title,
    subtitle: entry.fr.body,
  });
}
