import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasOwnAccount } from "@/lib/auth/get-user";
import { FeaturePage } from "@/components/marketing/FeaturePage";
import { getLocale } from "@/lib/locale";
import {
  featureHref,
  featureIdOfSlug,
  getLandingPage,
  landingCopy,
} from "@/components/marketing/landing-copy";
import { FEATURE_SLUGS } from "@/components/marketing/feature-slugs";
import { shareMetadata } from "@/lib/og/share-metadata";

interface FeatureRouteProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  // One French address per page, whatever the reader's language: routes do
  // not change with it (`feature-slugs.ts`).
  return landingCopy.pages.map((page) => ({
    slug: FEATURE_SLUGS[page.id],
  }));
}

export async function generateMetadata({
  params,
}: FeatureRouteProps): Promise<Metadata> {
  const id = featureIdOfSlug((await params).slug);
  if (!id) {
    return { title: "Pluclair" };
  }
  const locale = await getLocale();
  const page = getLandingPage(id, locale);
  return shareMetadata({
    title: `${page.title} — Pluclair`,
    description: page.body,
    path: featureHref(id),
    locale,
  });
}

export default async function FeatureRoutePage({ params }: FeatureRouteProps) {
  const id = featureIdOfSlug((await params).slug);
  if (!id) {
    notFound();
  }
  return <FeaturePage pageId={id} isLoggedIn={await hasOwnAccount()} />;
}
