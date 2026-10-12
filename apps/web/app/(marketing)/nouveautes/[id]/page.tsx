import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { changeText } from "@finance/core/changelog";
import { CHANGELOG } from "@finance/core/changelog-entries";
import { NouveautesPage } from "@/components/marketing/NouveautesPage";
import {
  NOUVEAUTES_HREF,
  nouveautesCopyFor,
  nouveautesEntryHref,
} from "@/components/marketing/nouveautes-copy";
import { getLocale } from "@/lib/locale";
import { shareMetadata } from "@/lib/og/share-metadata";

interface EntryRouteProps {
  params: Promise<{ id: string }>;
}

function entryFor(id: string) {
  return CHANGELOG.find((entry) => entry.id === id) ?? null;
}

export async function generateMetadata({
  params,
}: EntryRouteProps): Promise<Metadata> {
  const { id } = await params;
  const entry = entryFor(id);
  if (!entry) {
    return { title: "Pluclair" };
  }
  const locale = await getLocale();
  const text = changeText(entry, locale);
  return shareMetadata({
    title: `${text.title} — ${nouveautesCopyFor(locale).meta.title} — Pluclair`,
    description: text.body,
    path: nouveautesEntryHref(entry.id),
    canonical: NOUVEAUTES_HREF,
    locale,
  });
}

/**
 * One change, by its own address: the whole list, with that entry open
 * where it stands, so a shared link lands on the change and the rest is
 * still there around it.
 */
export default async function NouveautesEntryRoutePage({
  params,
}: EntryRouteProps) {
  const { id } = await params;
  if (!entryFor(id)) {
    notFound();
  }
  return <NouveautesPage openId={id} />;
}
