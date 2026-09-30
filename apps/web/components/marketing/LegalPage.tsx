import Link from "next/link";
import { Fragment } from "react";
import { getLocale } from "@/lib/locale";
import {
  LEGAL_DRAFT,
  legalCopyFor,
  type LegalSection,
} from "@/components/marketing/legal-copy";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

/**
 * One legal document, set for reading rather than for skimming past.
 *
 * A single column at a reading measure, the contents at the top as anchors,
 * and none of the landing page's motion: somebody on this page is checking
 * what they agreed to, and a paragraph that fades in is a paragraph that was
 * briefly not there to read.
 */
export async function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const locale = await getLocale();
  const copy = legalCopyFor(locale);
  const page = copy[doc];
  const other = doc === "privacy" ? "terms" : "privacy";
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(`${copy.updated}T12:00:00Z`),
  );

  return (
    <article className="relative mx-auto w-full max-w-3xl px-6 pb-20 pt-32 md:pb-28 md:pt-40">
      {LEGAL_DRAFT ? (
        <p
          role="note"
          className="mb-10 rounded-control border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-marketing-ink"
        >
          {copy.draftNotice}
        </p>
      ) : null}

      <header>
        <h1 className="marketing-display text-display-section">{page.title}</h1>
        <p className="mt-5 text-base leading-relaxed text-marketing-muted md:text-lg">
          {page.summary}
        </p>
        <p className="mt-4 text-sm text-marketing-faint">
          {copy.updatedLabel} <time dateTime={copy.updated}>{updated}</time>
        </p>
      </header>

      <nav
        aria-label={copy.contents}
        className="glass-flat mt-10 rounded-card px-5 py-4"
      >
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-marketing-faint">
          {copy.contents}
        </h2>
        <ol className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {page.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={cn(
                  "flex min-h-11 items-center rounded-control text-sm text-marketing-muted transition-colors duration-hover hover:text-white lg:min-h-9",
                  marketingFocus,
                )}
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 flex flex-col gap-10">
        {page.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
      </div>

      <p className="mt-16 border-t border-white/10 pt-6 text-sm text-marketing-muted">
        <Link
          href={`/${other}`}
          className={cn(
            "rounded-control underline decoration-white/30 underline-offset-4 transition-colors duration-hover hover:text-white",
            marketingFocus,
          )}
        >
          {copy.nav[other]}
        </Link>
      </p>
    </article>
  );
}

function Section({ section }: { section: LegalSection }) {
  return (
    // Anchored clear of the fixed header, which is what a contents link
    // would otherwise land the heading underneath.
    <section id={section.id} className="scroll-mt-28">
      <h2 className="font-head text-xl text-marketing-ink">
        {section.heading}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-marketing-muted">
        {section.body.map((paragraph) => (
          <p key={paragraph}>
            <Blanks text={paragraph} />
          </p>
        ))}
        {section.points ? (
          <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-marketing-faint">
            {section.points.map((point) => (
              <li key={point}>
                <Blanks text={point} />
              </li>
            ))}
          </ul>
        ) : null}
        {section.after?.map((paragraph) => (
          <p key={paragraph}>
            <Blanks text={paragraph} />
          </p>
        ))}
      </div>
    </section>
  );
}

/** A sentence with its `[[…]]` blanks drawn as blanks, not as text. */
function Blanks({ text }: { text: string }) {
  const parts = text.split(/\[\[(.+?)\]\]/);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="rounded-sm border border-dashed border-primary/60 bg-primary/15 px-1 text-marketing-ink"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
