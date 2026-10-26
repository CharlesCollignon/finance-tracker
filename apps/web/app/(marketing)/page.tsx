import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/get-user";
import { demoAvailable } from "@/lib/demo-env";
import { LandingPage } from "@/components/marketing/LandingPage";
import { landingCopyFor } from "@/components/marketing/landing-copy";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { hero } = landingCopyFor(locale);
  return shareMetadata({
    title: `Pluclair — ${hero.titleLines.join(" ")}`,
    description: hero.tagline,
    path: "/",
    locale,
  });
}

export default async function HomePage() {
  const user = await getAuthUser();
  return <LandingPage isLoggedIn={Boolean(user)} demo={demoAvailable()} />;
}
