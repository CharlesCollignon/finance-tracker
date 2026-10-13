import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideArticle } from "@/components/marketing/blog/GuideArticle";
import {
  BLOG_RSS_HREF,
  GUIDE_SLUGS,
  guideHref,
  isGuideSlug,
} from "@/lib/guide-list";
import { loadGuide } from "@/lib/guides";
import { shareMetadata } from "@/lib/og/share-metadata";

interface GuideRouteProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

/** Only the guides there are: anything else is a 404, not a render. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: GuideRouteProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isGuideSlug(slug)) {
    return { title: "Pluclair" };
  }
  const { meta } = await loadGuide(slug);
  // French whatever the reader's setting: the guides exist only in French.
  return shareMetadata({
    title: `${meta.title} — Pluclair`,
    description: meta.description,
    path: guideHref(slug),
    feed: BLOG_RSS_HREF,
    locale: "fr",
  });
}

export default async function GuideRoutePage({ params }: GuideRouteProps) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) {
    notFound();
  }
  return <GuideArticle slug={slug} />;
}
