import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/marketing/LegalPage";
import {
  legalCopyFor,
  legalPagesVisible,
} from "@/components/marketing/legal-copy";
import { getLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const page = legalCopyFor(await getLocale()).notice;
  return { title: `${page.title} — Pluclair`, description: page.summary };
}

/** The legal notice every French site must show (LCEN art. 1-1). */
export default function NoticePage() {
  // A draft is readable on preview and local builds, not in production.
  if (!legalPagesVisible()) {
    notFound();
  }
  return <LegalPage doc="notice" />;
}
