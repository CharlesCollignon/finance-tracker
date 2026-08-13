import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { FeaturePage } from "@/components/marketing/FeaturePage";
import {
  isLandingPageId,
  landingCopy,
} from "@/components/marketing/landing-copy";

interface FeatureRouteProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return landingCopy.pages.map((page) => ({ slug: page.id }));
}

export async function generateMetadata({
  params,
}: FeatureRouteProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isLandingPageId(slug)) {
    return { title: "Pluclair" };
  }
  const page = landingCopy.pages.find((entry) => entry.id === slug);
  if (!page) {
    return { title: "Pluclair" };
  }
  return {
    title: `${page.title} — Pluclair`,
    description: page.body,
  };
}

export default async function FeatureRoutePage({
  params,
}: FeatureRouteProps) {
  const { slug } = await params;
  if (!isLandingPageId(slug)) {
    notFound();
  }
  const user = await getAuthUser();
  return <FeaturePage pageId={slug} isLoggedIn={Boolean(user)} />;
}
