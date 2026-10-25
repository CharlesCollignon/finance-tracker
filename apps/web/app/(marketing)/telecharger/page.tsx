import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth/get-user";
import { DownloadPage } from "@/components/marketing/DownloadPage";
import {
  DOWNLOAD_HREF,
  downloadCopyFor,
} from "@/components/marketing/download-copy";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";

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
  const user = await getAuthUser();
  return <DownloadPage isLoggedIn={Boolean(user)} />;
}
