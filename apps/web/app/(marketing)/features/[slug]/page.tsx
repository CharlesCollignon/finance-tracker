import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { FeaturePage } from "@/components/marketing/FeaturePage";
import { getLocale } from "@/lib/locale";
import {
  featureHref,
  isLandingPageId,
  getLandingPage,
  landingCopy,
} from "@/components/marketing/landing-copy";
import { shareMetadata } from "@/lib/og/share-metadata";

interface FeatureRouteProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  // The English array, deliberately: an id is a route, and routes do not
  // change with the reader's language.
  return landingCopy.pages.map((page) => ({ slug: page.id }));
}

export async function generateMetadata({
  params,
}: FeatureRouteProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isLandingPageId(slug)) {
    return { title: "Pluclair" };
  }
  const locale = await getLocale();
  const page = getLandingPage(slug, locale);
  return shareMetadata({
    title: `${page.title} — Pluclair`,
    description: page.body,
    path: featureHref(slug),
    locale,
  });
}

export default async function FeatureRoutePage({ params }: FeatureRouteProps) {
  const { slug } = await params;
  if (!isLandingPageId(slug)) {
    notFound();
  }
  const user = await getAuthUser();
  return <FeaturePage pageId={slug} isLoggedIn={Boolean(user)} />;
}
