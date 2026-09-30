import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/marketing/LegalPage";
import {
  legalCopyFor,
  legalPagesVisible,
} from "@/components/marketing/legal-copy";
import { getLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const page = legalCopyFor(await getLocale()).terms;
  return { title: `${page.title} — Pluclair`, description: page.summary };
}

export default function TermsPage() {
  // A draft is readable on preview and local builds, not in production.
  if (!legalPagesVisible()) {
    notFound();
  }
  return <LegalPage doc="terms" />;
}
