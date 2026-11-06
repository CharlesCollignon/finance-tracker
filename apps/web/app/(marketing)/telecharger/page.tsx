import type { Metadata } from "next";
import { hasOwnAccount } from "@/lib/auth/get-user";
import { DownloadPage } from "@/components/marketing/DownloadPage";
import {
  DOWNLOAD_HREF,
  downloadCopyFor,
} from "@/components/marketing/download-copy";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";
import { JsonLd } from "@/components/JsonLd";
import { faqPage, graph } from "@/lib/seo/structured-data";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { meta } = downloadCopyFor(locale);
  return shareMetadata({
    title: `${meta.title} — Pluclair`,
    description: meta.description,
    path: DOWNLOAD_HREF,
    locale,
  });
}

/** The Android app, to download (`components/marketing/DownloadPage.tsx`). */
export default async function DownloadRoutePage() {
  const locale = await getLocale();
  const { faq } = downloadCopyFor(locale);
  return (
    <>
      <JsonLd data={graph([faqPage(faq.items, locale)])} />
      <DownloadPage isLoggedIn={await hasOwnAccount()} />
    </>
  );
}
