import type { Metadata } from "next";
import { NouveautesPage } from "@/components/marketing/NouveautesPage";
import {
  NOUVEAUTES_HREF,
  nouveautesCopyFor,
} from "@/components/marketing/nouveautes-copy";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { meta } = nouveautesCopyFor(locale);
  return shareMetadata({
    title: `${meta.title} — Pluclair`,
    description: meta.description,
    path: NOUVEAUTES_HREF,
    locale,
  });
}

/** Everything that has changed, newest first (`NouveautesPage.tsx`). */
export default function NouveautesRoutePage() {
  return <NouveautesPage openId={null} />;
}
