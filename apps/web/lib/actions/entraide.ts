"use server";

import type { ActionResult } from "@finance/core/action-result";
import {
  isEntraideFilter,
  isEntraideSort,
  threadHref,
  type EntraideMatch,
  type PostKind,
} from "@finance/core/entraide";
import type { Db } from "@finance/data/client";
import * as entraide from "@finance/data/entraide";
import { toCard, type EntraideCard } from "@/lib/entraide-cards";
import * as write from "@/lib/entraide-write";
import { getAuthUser } from "@/lib/auth/get-user";
import { matchGuides } from "@/lib/guide-search";
import { allGuides } from "@/lib/guides";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { entraideRulesVisible } from "@/components/marketing/legal-status";

/**
 * Entraide's writes and its two client-side reads. The writes are
 * `lib/entraide-write.ts`'s, which the phone reaches too
 * (`app/api/entraide`), run here as the cookie session's person: masked,
 * kept with who wrote them, refused while Entraide is closed.
 *
 * The pages read cookies, so they are drawn fresh on each visit; a write
 * still marks the list and the thread stale, for the router's cache.
 */

/** Run `work` as the signed-in person, or refuse if there is none. */
async function asWriter<T extends object>(
  work: (db: Db, writer: write.EntraideWriter) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" } as ActionResult<T>;
  }
  return work(await createClient(), { id: user.id, email: user.email ?? null });
}

/** « Déjà demandé ? »: open threads and guides close to what is being typed. */
export async function searchAlreadyAsked(query: string): Promise<{
  threads: (EntraideMatch & { href: string })[];
  guides: { slug: string; title: string; href: string }[];
}> {
  if (!entraideRulesVisible() || query.trim().length < 3) {
    return { threads: [], guides: [] };
  }
  const [threads, guides] = await Promise.all([
    createClient()
      .then((db) => entraide.searchEntraide(db, query.slice(0, 200)))
      .catch(() => []),
    allGuides(),
  ]);
  return {
    threads: threads.map((thread) => ({
      ...thread,
      href: threadHref(thread.id, thread.title),
    })),
    guides: matchGuides(query, guides).map((guide) => ({
      ...guide,
      href: `/blog/${guide.slug}`,
    })),
  };
}

/** The next page of the list, as cards. */
export async function loadMorePosts(
  filter: string,
  sort: string,
  offset: number,
): Promise<EntraideCard[]> {
  if (
    !entraideRulesVisible() ||
    !isEntraideFilter(filter) ||
    !isEntraideSort(sort)
  ) {
    return [];
  }
  const locale = await getLocale();
  const db = await createClient();
  const posts = await entraide
    .readEntraideList(db, {
      filter,
      sort,
      offset: Math.max(0, offset),
      limit: 20,
    })
    .catch(() => []);
  const now = new Date();
  return posts.map((post) => toCard(post, locale, now));
}

/**
 * A new question or share, with the pseudonym chosen on the way if this is
 * the person's first. Answers with the new card, for the list to draw.
 */
export async function publishPost(input: {
  kind: PostKind;
  title: string;
  body: string;
  handle?: string;
  guideSlug?: string | null;
}): Promise<ActionResult<{ card: EntraideCard }>> {
  const locale = await getLocale();
  return asWriter<{ card: EntraideCard }>(async (db, writer) => {
    const created = await write.writePost(db, writer, input);
    if (!created.success) {
      return { error: created.error };
    }
    // Drawn from what was just written; the list's next read has the rest.
    const now = new Date();
    return {
      success: true,
      card: toCard(
        {
          id: created.id,
          kind: input.kind,
          title: created.title,
          excerpt: created.body,
          author: { handle: created.handle, isPluclair: false, isMine: true },
          gone: false,
          createdAt: now.toISOString(),
          lastActivityAt: now.toISOString(),
          replyCount: 0,
          solved: false,
          usefulCount: 0,
        },
        locale,
        now,
      ),
    };
  });
}

export async function editPost(
  id: number,
  input: { title: string; body: string },
): Promise<ActionResult> {
  return asWriter((db, writer) => write.changePost(db, writer, id, input));
}

export async function deletePost(id: number): Promise<ActionResult> {
  return asWriter((db, writer) => write.removePost(db, writer, id));
}

/** An answer to a thread. */
export async function publishReply(
  postId: number,
  text: string,
  handle?: string,
): Promise<ActionResult<{ id: number }>> {
  return asWriter((db, writer) =>
    write.writeReply(db, writer, postId, text, handle),
  );
}

export async function editReply(
  id: number,
  text: string,
): Promise<ActionResult> {
  return asWriter((db, writer) => write.changeReply(db, writer, id, text));
}

export async function deleteReply(id: number): Promise<ActionResult> {
  return asWriter((db, writer) => write.removeReply(db, writer, id));
}

/** The asker marks an answer « Résolu », or takes the mark back (`null`). */
export async function setSolved(
  postId: number,
  replyId: number | null,
): Promise<ActionResult> {
  return asWriter((db, writer) => write.settle(db, writer, postId, replyId));
}

/** « Signaler »: a question or an answer, with the rule it breaks. */
export async function reportTarget(
  target: string,
  reason: string,
  note: string,
): Promise<ActionResult> {
  return asWriter((db, writer) =>
    write.report(db, writer, target, reason, note),
  );
}
