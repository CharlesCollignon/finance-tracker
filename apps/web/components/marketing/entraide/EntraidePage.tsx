/* Hallmark · genre: atmospheric · macrostructure: Index-First (a composer, then the list) · theme: design.md (Pluclair) · enrichment: none — the questions are the page · nav: kept · footer: kept */

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  ENTRAIDE_HREF,
  type EntraideFilter,
  type EntraideSort,
} from "@finance/core/entraide";
import * as entraide from "@finance/data/entraide";
import { getAuthUser } from "@/lib/auth/get-user";
import { toCard } from "@/lib/entraide-cards";
import { BLOG_HREF } from "@/lib/guide-list";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { blogCopyFor } from "@/components/marketing/blog-copy";
import { entraideCopyFor } from "@/components/marketing/entraide-copy";
import { EntraideBoard } from "@/components/marketing/entraide/EntraideBoard";
import { FadeUp, RiseLines } from "@/components/marketing/LandingReveal";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

export const ENTRAIDE_RULES_HREF = `${ENTRAIDE_HREF}/regles`;

/**
 * Entraide: its name and what it is for, the way to its rules, then the
 * board — « Posez votre question… », the doors, the list (`EntraideBoard`).
 */
export async function EntraidePage({
  filter,
  sort,
  guideSlug,
}: {
  filter: EntraideFilter;
  sort: EntraideSort;
  guideSlug: string | null;
}) {
  const locale = await getLocale();
  const copy = entraideCopyFor(locale);
  const user = await getAuthUser();
  const db = await createClient();
  const [posts, handle] = await Promise.all([
    entraide.readEntraideList(db, { filter, sort }).catch(() => []),
    user
      ? entraide.readMyHandle(db, user.id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const now = new Date();
  const here = guideSlug
    ? `${ENTRAIDE_HREF}?guide=${encodeURIComponent(guideSlug)}`
    : ENTRAIDE_HREF;

  return (
    <div className="relative isolate overflow-x-clip">
      <section className="relative px-6 pb-12 pt-32 md:pb-16 md:pt-44">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem]"
          aria-hidden
        >
          <div className="marketing-sparks absolute inset-0 opacity-60" />
        </div>
        <div className="mx-auto max-w-3xl">
          <FadeUp trigger="mount" delay={0.05}>
            <Link
              href={BLOG_HREF}
              className={cn(
                "group mb-8 inline-flex min-h-11 items-center gap-2 rounded-full text-sm text-marketing-muted transition-colors duration-hover hover:text-white",
                marketingFocus,
              )}
            >
              <ArrowLeft
                size={14}
                aria-hidden
                className="transition-transform duration-hover group-hover:-translate-x-0.5"
              />
              {blogCopyFor(locale).meta.title}
            </Link>
          </FadeUp>
          <RiseLines
            lines={[copy.hero.title]}
            className="marketing-display text-display-hero"
            delay={0.2}
          />
          <FadeUp trigger="mount" delay={0.5}>
            <p className="mt-6 max-w-xl text-[0.975rem] leading-relaxed text-marketing-muted sm:text-lg">
              {copy.hero.intro}
            </p>
            <Link
              href={ENTRAIDE_RULES_HREF}
              className={cn(
                "group mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full text-sm text-marketing-ink",
                marketingFocus,
              )}
            >
              {copy.hero.rules}
              <ArrowRight
                size={14}
                aria-hidden
                className="transition-transform duration-hover group-hover:translate-x-0.5"
              />
            </Link>
          </FadeUp>
        </div>
      </section>

      <section aria-label={copy.meta.title} className="px-6 pb-24 md:pb-32">
        <FadeUp trigger="mount" delay={0.65} className="mx-auto max-w-3xl">
          <EntraideBoard
            cards={posts.map((post) => toCard(post, locale, now))}
            filter={filter}
            sort={sort}
            copy={copy}
            signedIn={Boolean(user)}
            handle={handle}
            loginHref={`/login?next=${encodeURIComponent(here)}`}
            guideSlug={guideSlug}
          />
        </FadeUp>
      </section>
    </div>
  );
}
