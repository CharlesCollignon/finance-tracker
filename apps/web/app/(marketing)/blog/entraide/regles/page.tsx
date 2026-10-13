import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { entraideRulesCopyFor } from "@/components/marketing/entraide-rules-copy";
import { LegalArticle } from "@/components/marketing/LegalPage";
import {
  LEGAL_PATHS,
  legalCopyFor,
  legalPagesVisible,
} from "@/components/marketing/legal-copy";
import {
  ENTRAIDE_RULES_DRAFT,
  entraideRulesVisible,
} from "@/components/marketing/legal-status";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { getLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { document } = entraideRulesCopyFor(await getLocale());
  return {
    title: `${document.title} — Pluclair`,
    description: document.summary,
  };
}

/** « Les règles d'Entraide »: a draft, readable on preview and local builds only. */
export default async function EntraideRulesPage() {
  if (!entraideRulesVisible()) {
    notFound();
  }
  const locale = await getLocale();
  const copy = entraideRulesCopyFor(locale);
  const legal = legalCopyFor(locale);
  const linkClass = cn(
    "rounded-control underline decoration-white/30 underline-offset-4 transition-colors duration-hover hover:text-white",
    marketingFocus,
  );

  return (
    <LegalArticle
      page={copy.document}
      locale={locale}
      updated={copy.updated}
      draftNotice={ENTRAIDE_RULES_DRAFT ? copy.draftNotice : null}
    >
      {legalPagesVisible() ? (
        <>
          <Link href={LEGAL_PATHS.terms} className={linkClass}>
            {legal.nav.terms}
          </Link>
          <Link href={LEGAL_PATHS.privacy} className={linkClass}>
            {legal.nav.privacy}
          </Link>
        </>
      ) : null}
    </LegalArticle>
  );
}
