import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { ENTRAIDE_HREF, threadHref } from "@finance/core/entraide";
import type { Database } from "@finance/core/types/database";
import * as entraide from "@finance/data/entraide";
import { ABOUT_HREF } from "@/components/marketing/about-copy";
import { DOWNLOAD_HREF } from "@/components/marketing/download-copy";
import { storeLinks } from "@/lib/store-links";
import { featureHref, landingCopy } from "@/components/marketing/landing-copy";
import {
  entraideRulesVisible,
  legalPagesVisible,
} from "@/components/marketing/legal-status";
import { NOUVEAUTES_HREF } from "@/components/marketing/nouveautes-copy";
import { BLOG_HREF, GUIDE_SLUGS, guideHref } from "@/lib/guide-list";
import { getSiteUrl, getSupabaseEnv } from "@/lib/supabase/env";

/**
 * The public pages, for search engines: the marketing site and nothing
 * behind the login. One URL per page, whatever the reader's language, because
 * the language is a cookie and not a path (`lib/locale.ts`).
 *
 * The legal pages, and Entraide with its rules, are listed only where they
 * are served (`LEGAL_DRAFT`, `ENTRAIDE_RULES_DRAFT`), and Entraide's threads
 * with them — each one still there, dated by its last answer, so a crawler
 * finds a new one without paging through the list. A Nouveautés entry's own address
 * is not listed: it is the list with that entry open, and says so with its
 * canonical link.
 */
/** Read again every hour, for the threads; the rest only changes on deploy. */
export const revalidate = 3600;

/** The list answers 50 at a time (`entraide_list`); a ceiling of 1,000. */
const THREAD_PAGE = 50;
const THREAD_PAGES = 20;

/**
 * Every thread a search engine should keep (`indexable` in `ThreadPage`):
 * not one whose author has gone. Read as a visitor, without cookies, since
 * the sitemap is the same for everyone. Never fails the sitemap: anything
 * wrong and it lists no thread.
 */
async function entraideThreads(base: string): Promise<MetadataRoute.Sitemap> {
  try {
    const { url, anonKey } = getSupabaseEnv();
    const db = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const threads: MetadataRoute.Sitemap = [];
    for (let page = 0; page < THREAD_PAGES; page += 1) {
      const posts = await entraide.readEntraideList(db, {
        filter: "all",
        sort: "recent",
        offset: page * THREAD_PAGE,
        limit: THREAD_PAGE,
      });
      for (const post of posts) {
        if (!post.gone) {
          threads.push({
            url: new URL(threadHref(post.id, post.title), base).toString(),
            lastModified: post.lastActivityAt,
            priority: 0.5,
          });
        }
      }
      if (posts.length < THREAD_PAGE) {
        break;
      }
    }
    return threads;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const paths = [
    "/",
    ABOUT_HREF,
    ...(storeLinks().androidApk ? [DOWNLOAD_HREF] : []),
    NOUVEAUTES_HREF,
    BLOG_HREF,
    ...GUIDE_SLUGS.map(guideHref),
    ...landingCopy.pages.map((page) => featureHref(page.id)),
    ...(legalPagesVisible() ? ["/privacy", "/terms", "/mentions-legales"] : []),
    ...(entraideRulesVisible()
      ? [ENTRAIDE_HREF, `${ENTRAIDE_HREF}/regles`]
      : []),
  ];
  return [
    ...paths.map((path) => ({
      url: new URL(path, base).toString(),
      priority: path === "/" ? 1 : 0.7,
    })),
    ...(entraideRulesVisible() ? await entraideThreads(base) : []),
  ];
}
