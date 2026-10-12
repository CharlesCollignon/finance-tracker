import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/get-user";
import { AboutPage } from "@/components/marketing/AboutPage";
import { ABOUT_HREF, aboutCopyFor } from "@/components/marketing/about-copy";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { meta } = aboutCopyFor(locale);
  return shareMetadata({
    title: `${meta.title} — Pluclair`,
    description: meta.description,
    path: ABOUT_HREF,
    locale,
  });
}

/** Who makes Pluclair, and why (`components/marketing/AboutPage.tsx`). */
export default async function AboutRoutePage() {
  const user = await getAuthUser();
  return <AboutPage isLoggedIn={Boolean(user)} />;
}
