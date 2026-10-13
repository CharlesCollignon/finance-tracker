"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@finance/core/action-result";
import {
  ENTRAIDE_HREF,
  ENTRAIDE_LIMITS,
  handleProblem,
  isEntraideFilter,
  isEntraideSort,
  threadHref,
  type EntraideMatch,
  type PostKind,
} from "@finance/core/entraide";
import { maskPersonalData } from "@finance/core/entraide-mask";
import type { Db } from "@finance/data/client";
import * as entraide from "@finance/data/entraide";
import { asUser } from "@/lib/actions/as-user";
import { toCard, type EntraideCard } from "@/lib/entraide-cards";
import { isGuideSlug } from "@/lib/guide-list";
import { matchGuides } from "@/lib/guide-search";
import { allGuides } from "@/lib/guides";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { entraideRulesVisible } from "@/components/marketing/legal-status";

/**
 * Entraide's writes and its two client-side reads. Every write is the
 * signed-in person's own (`asUser`), masked before it is saved
 * (`maskPersonalData`, which the form's preview has already shown), and
 * refused while Entraide is closed — it opens with its rules
 * (`ENTRAIDE_RULES_DRAFT`). What the database refuses comes back by name
 * (`entraideError`), for the form to say in words.
 *
 * The pages read cookies, so they are drawn fresh on each visit; a write
 * still marks the list and the thread stale, for the router's cache.
 */

const CLOSED = { error: "errors.notAllowed" } as const;

function fits(text: string, min: number, max: number): boolean {
  const length = text.trim().length;
  return length >= min && length <= max;
}

function redraw(href?: string) {
  revalidatePath(ENTRAIDE_HREF);
  if (href) {
    revalidatePath(href);
  }
}

/**
 * The writer's pseudonym: theirs already, or `chosen`, taken now if it may
 * be. The error names what is wrong with `chosen` otherwise.
 */
async function ensureHandle(
  db: Db,
  userId: string,
  chosen: string | undefined,
): Promise<{ handle: string } | { error: string }> {
  const current = await entraide.readMyHandle(db, userId);
  if (current) {
    return { handle: current };
  }
  const handle = chosen?.trim() ?? "";
  const problem = handleProblem(handle);
  if (problem) {
    return {
      error:
        problem === "reserved"
          ? "entraide.handleReserved"
          : handle
            ? "entraide.handleInvalid"
            : "entraide.noHandle",
    };
  }
  const taken = await entraide.chooseHandle(db, userId, handle);
  return taken.success ? { handle } : { error: taken.error };
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
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const title = maskPersonalData(input.title).text;
  const body = maskPersonalData(input.body).text;
  if (
    (input.kind !== "question" && input.kind !== "share") ||
    !fits(title, ENTRAIDE_LIMITS.titleMin, ENTRAIDE_LIMITS.titleMax) ||
    body.trim().length > ENTRAIDE_LIMITS.bodyMax
  ) {
    return { error: "errors.invalidInput" };
  }
  const locale = await getLocale();
  return asUser<{ card: EntraideCard }>(
    async (db, userId): Promise<ActionResult<{ card: EntraideCard }>> => {
      const writer = await ensureHandle(db, userId, input.handle);
      if ("error" in writer) {
        return { error: writer.error };
      }
      const { handle } = writer;
      const created = await entraide.createPost(db, userId, {
        kind: input.kind,
        title,
        body,
        guideSlug:
          input.guideSlug && isGuideSlug(input.guideSlug)
            ? input.guideSlug
            : null,
      });
      if (!created.success) {
        return { error: created.error };
      }
      redraw();
      // Drawn from what was just written; the list's next read has the rest.
      const now = new Date();
      return {
        success: true,
        card: toCard(
          {
            id: created.id,
            kind: input.kind,
            title: title.trim(),
            excerpt: body.trim(),
            author: { handle, isPluclair: false, isMine: true },
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
    },
    { redraw: "never" },
  );
}

export async function editPost(
  id: number,
  input: { title: string; body: string },
): Promise<ActionResult> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const title = maskPersonalData(input.title).text;
  const body = maskPersonalData(input.body).text;
  if (
    !fits(title, ENTRAIDE_LIMITS.titleMin, ENTRAIDE_LIMITS.titleMax) ||
    body.trim().length > ENTRAIDE_LIMITS.bodyMax
  ) {
    return { error: "errors.invalidInput" };
  }
  const result = await asUser(
    (db, userId) => entraide.editPost(db, userId, id, { title, body }),
    { redraw: "never" },
  );
  if (result.success) {
    redraw(threadHref(id, title));
  }
  return result;
}

export async function deletePost(id: number): Promise<ActionResult> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const result = await asUser(
    (db, userId) => entraide.deletePost(db, userId, id),
    { redraw: "never" },
  );
  if (result.success) {
    redraw();
  }
  return result;
}

/** An answer to a thread. */
export async function publishReply(
  postId: number,
  text: string,
  handle?: string,
): Promise<ActionResult<{ id: number }>> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const body = maskPersonalData(text).text;
  if (!fits(body, ENTRAIDE_LIMITS.replyMin, ENTRAIDE_LIMITS.replyMax)) {
    return { error: "errors.invalidInput" };
  }
  const result = await asUser(
    async (db, userId): Promise<ActionResult<{ id: number }>> => {
      const writer = await ensureHandle(db, userId, handle);
      if ("error" in writer) {
        return { error: writer.error };
      }
      return entraide.createReply(db, userId, postId, body);
    },
    { redraw: "never" },
  );
  if (result.success) {
    redraw();
  }
  return result;
}

export async function editReply(
  id: number,
  text: string,
): Promise<ActionResult> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const body = maskPersonalData(text).text;
  if (!fits(body, ENTRAIDE_LIMITS.replyMin, ENTRAIDE_LIMITS.replyMax)) {
    return { error: "errors.invalidInput" };
  }
  return asUser((db, userId) => entraide.editReply(db, userId, id, body), {
    redraw: "never",
  });
}

export async function deleteReply(id: number): Promise<ActionResult> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const result = await asUser(
    (db, userId) => entraide.deleteReply(db, userId, id),
    { redraw: "never" },
  );
  if (result.success) {
    redraw();
  }
  return result;
}

/** The asker marks an answer « Résolu », or takes the mark back (`null`). */
export async function setSolved(
  postId: number,
  replyId: number | null,
): Promise<ActionResult> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const result = await asUser(
    (db, userId) => entraide.markSolved(db, userId, postId, replyId),
    { redraw: "never" },
  );
  if (result.success) {
    redraw();
  }
  return result;
}
