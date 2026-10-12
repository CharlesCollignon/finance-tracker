import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/get-user";
import { AboutPage } from "@/components/marketing/AboutPage";
import { aboutCopyFor } from "@/components/marketing/about-copy";
import { getLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = aboutCopyFor(await getLocale());
  return { title: `${meta.title} — Pluclair`, description: meta.description };
}

/** Who makes Pluclair, and why (`components/marketing/AboutPage.tsx`). */
export default async function AboutRoutePage() {
  const user = await getAuthUser();
  return <AboutPage isLoggedIn={Boolean(user)} />;
}
