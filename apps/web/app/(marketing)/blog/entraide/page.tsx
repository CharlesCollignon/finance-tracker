import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ENTRAIDE_HREF } from "@finance/core/entraide";
import { entraideCopyFor } from "@finance/core/entraide-copy";
import { EntraidePage } from "@/components/marketing/entraide/EntraidePage";
import {
  filterFromParam,
  sortFromParam,
} from "@/components/marketing/entraide/params";
import { entraideRulesVisible } from "@/components/marketing/legal-status";
import { isGuideSlug } from "@/lib/guide-list";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { meta } = entraideCopyFor(locale);
  return shareMetadata({
    title: `${meta.title} — Pluclair`,
    description: meta.description,
    path: ENTRAIDE_HREF,
    locale,
  });
}

/**
 * Entraide's list. It opens with its rules: until they are signed
 * (`ENTRAIDE_RULES_DRAFT`), production answers 404 here as there.
 */
export default async function EntraideRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!entraideRulesVisible()) {
    notFound();
  }
  const params = await searchParams;
  const guide = typeof params.guide === "string" ? params.guide : null;
  return (
    <EntraidePage
      filter={filterFromParam(params.filtre)}
      sort={sortFromParam(params.tri)}
      guideSlug={guide && isGuideSlug(guide) ? guide : null}
    />
  );
}
