import type { Metadata } from "next";
import { hasOwnAccount } from "@/lib/auth/get-user";
import { demoAvailable } from "@/lib/demo-env";
import { LandingPage } from "@/components/marketing/LandingPage";
import { landingCopyFor } from "@/components/marketing/landing-copy";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";
import { JsonLd } from "@/components/JsonLd";
import { ANDROID_DOWNLOAD_PATH, storeLinks } from "@/lib/store-links";
import {
  faqPage,
  graph,
  organization,
  softwareApplication,
  website,
} from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/supabase/env";

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
  const locale = await getLocale();
  const { hero, faq } = landingCopyFor(locale);
  const base = getSiteUrl();
  return (
    <>
      <JsonLd
        data={graph([
          organization(base),
          website(base, locale),
          softwareApplication({
            base,
            description: hero.tagline,
            downloadPath: storeLinks().androidApk
              ? ANDROID_DOWNLOAD_PATH
              : null,
          }),
          faqPage(faq.items, locale),
        ])}
      />
      <LandingPage isLoggedIn={await hasOwnAccount()} demo={demoAvailable()} />
    </>
  );
}
