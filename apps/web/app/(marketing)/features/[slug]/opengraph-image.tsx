import { translator } from "@finance/core/i18n/t";
import {
  getLandingPage,
  isLandingPageId,
  landingCopyFor,
} from "@/components/marketing/landing-copy";
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from "@/lib/og/og-card";

/** A feature page's link preview: its name and its one line. */
export const alt = "Pluclair — Le produit";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isLandingPageId(slug)) {
    const { hero } = landingCopyFor("fr");
    return ogCard({ kicker: "Pluclair", title: hero.titleLines.join(" ") });
  }
  const page = getLandingPage(slug, "fr");
  return ogCard({
    kicker: translator("fr")("common.product"),
    title: page.title,
    subtitle: page.body,
  });
}
