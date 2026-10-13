import type { ActionResult } from "@finance/core/action-result";
import type {
  EntraideAuthor,
  EntraideError,
  EntraideFilter,
  EntraideMatch,
  EntraidePost,
  EntraidePostSummary,
  EntraideReply,
  EntraideSort,
  EntraideStatus,
  PostKind,
} from "@finance/core/entraide";

import type { Db } from "./client";
import { dbError } from "./errors";
import { isMissingSchemaOrFunction } from "./schema";

/**
 * Entraide (migration 071), for both apps. Everything is read through the
 * migration's functions, which name an author by pseudonym and never by
 * user id; a person writes their own rows, and the triggers say what they
 * may not do, by name (`entraideError`). A database behind 071 reads as an
 * empty Entraide and refuses every write.
 */

/** A trigger's refusal, or Postgres', as the message a person should read. */
export function entraideError(error: {
  code?: string;
  message?: string;
}): EntraideError | string {
  const message = error.message ?? "";
  const named: Record<string, string> = {
    no_handle: "entraide.noHandle",
    handle_reserved: "entraide.handleReserved",
    banned: "entraide.banned",
    links_too_soon: "entraide.linksTooSoon",
    rate_limited: "errors.tooManyAttempts",
    not_allowed: "errors.notAllowed",
    invalid_solution: "errors.notAllowed",
  };
  for (const [reason, key] of Object.entries(named)) {
    if (message.includes(reason)) {
      return key;
    }
  }
  if (error.code === "23505" && message.includes("entraide_profiles")) {
    return "entraide.handleTaken";
  }
  if (error.code === "23514" && message.includes("entraide_profiles_handle")) {
    return "entraide.handleInvalid";
  }
  return dbError(error);
}

function author(row: {
  handle: string | null;
  is_pluclair: boolean;
  is_mine: boolean;
}): EntraideAuthor {
  return {
    handle: row.handle ?? null,
    isPluclair: row.is_pluclair,
    isMine: row.is_mine,
  };
}

export async function readEntraideList(
  db: Db,
  options: {
    filter: EntraideFilter;
    sort: EntraideSort;
    offset?: number;
    limit?: number;
  },
): Promise<EntraidePostSummary[]> {
  const { data, error } = await db.rpc("entraide_list", {
    p_filter: options.filter,
    p_sort: options.sort,
    p_offset: options.offset ?? 0,
    p_limit: options.limit ?? 20,
  });
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as PostKind,
    title: row.title,
    excerpt: row.excerpt,
    author: author(row),
    gone: row.gone,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    replyCount: Number(row.reply_count),
    solved: row.solved,
    usefulCount: Number(row.useful_count),
  }));
}

/** A thread and its answers, or null if there is none to show. */
export async function readThread(
  db: Db,
  id: number,
): Promise<{ post: EntraidePost; replies: EntraideReply[] } | null> {
  const [thread, replies] = await Promise.all([
    db.rpc("entraide_thread", { p_id: id }),
    db.rpc("entraide_replies", { p_post_id: id }),
  ]);
  for (const result of [thread, replies]) {
    if (result.error) {
      if (isMissingSchemaOrFunction(result.error)) {
        return null;
      }
      throw result.error;
    }
  }
  const row = thread.data?.[0];
  if (!row) {
    return null;
  }
  return {
    post: {
      id: row.id,
      kind: row.kind as PostKind,
      title: row.title,
      body: row.body,
      guideSlug: row.guide_slug ?? null,
      author: author(row),
      status: row.status as EntraideStatus,
      gone: row.gone,
      createdAt: row.created_at,
      editedAt: row.edited_at ?? null,
      solvedReplyId: row.solved_reply_id ?? null,
    },
    replies: (replies.data ?? []).map((reply) => ({
      id: reply.id,
      body: reply.body,
      author: author(reply),
      status: reply.status as EntraideStatus,
      gone: reply.gone,
      createdAt: reply.created_at,
      editedAt: reply.edited_at ?? null,
    })),
  };
}

/** « Déjà demandé ? »: the open threads closest to `query`. */
export async function searchEntraide(
  db: Db,
  query: string,
  limit = 5,
): Promise<EntraideMatch[]> {
  if (query.trim().length < 3) {
    return [];
  }
  const { data, error } = await db.rpc("entraide_search", {
    p_query: query,
    p_limit: limit,
  });
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as PostKind,
    title: row.title,
    replyCount: Number(row.reply_count),
    solved: row.solved,
  }));
}

/** The reader's pseudonym, or null before their first post. */
export async function readMyHandle(
  db: Db,
  userId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("entraide_profiles")
    .select("handle")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaOrFunction(error)) {
      return null;
    }
    throw error;
  }
  return data?.handle ?? null;
}

export async function chooseHandle(
  db: Db,
  userId: string,
  handle: string,
): Promise<ActionResult> {
  const { error } = await db
    .from("entraide_profiles")
    .insert({ user_id: userId, handle: handle.trim() });
  return error ? { error: entraideError(error) } : { success: true };
}

export async function createPost(
  db: Db,
  userId: string,
  post: {
    kind: PostKind;
    title: string;
    body: string;
    guideSlug?: string | null;
  },
): Promise<ActionResult<{ id: number }>> {
  const { data, error } = await db
    .from("entraide_posts")
    .insert({
      author_id: userId,
      kind: post.kind,
      title: post.title.trim(),
      body: post.body.trim(),
      guide_slug: post.guideSlug ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error ? entraideError(error) : "errors.couldNotSave" };
  }
  return { success: true, id: data.id };
}

export async function editPost(
  db: Db,
  userId: string,
  id: number,
  post: { title: string; body: string },
): Promise<ActionResult> {
  const { error } = await db
    .from("entraide_posts")
    .update({ title: post.title.trim(), body: post.body.trim() })
    .eq("id", id)
    .eq("author_id", userId);
  return error ? { error: entraideError(error) } : { success: true };
}

/** The author's own: emptied, and shown as « Message supprimé ». */
export async function deletePost(
  db: Db,
  userId: string,
  id: number,
): Promise<ActionResult> {
  const { error } = await db
    .from("entraide_posts")
    .update({ status: "deleted" })
    .eq("id", id)
    .eq("author_id", userId);
  return error ? { error: entraideError(error) } : { success: true };
}

/** The asker marks an answer « Résolu », or takes the mark back (`null`). */
export async function markSolved(
  db: Db,
  userId: string,
  postId: number,
  replyId: number | null,
): Promise<ActionResult> {
  const { data, error } = await db
    .from("entraide_posts")
    .update({ solved_reply_id: replyId })
    .eq("id", postId)
    .eq("author_id", userId)
    .select("id");
  if (error) {
    return { error: entraideError(error) };
  }
  return data && data.length > 0
    ? { success: true }
    : { error: "errors.notAllowed" };
}

export async function createReply(
  db: Db,
  userId: string,
  postId: number,
  body: string,
): Promise<ActionResult<{ id: number }>> {
  const { data, error } = await db
    .from("entraide_replies")
    .insert({ post_id: postId, author_id: userId, body: body.trim() })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error ? entraideError(error) : "errors.couldNotSave" };
  }
  return { success: true, id: data.id };
}

export async function editReply(
  db: Db,
  userId: string,
  id: number,
  body: string,
): Promise<ActionResult> {
  const { error } = await db
    .from("entraide_replies")
    .update({ body: body.trim() })
    .eq("id", id)
    .eq("author_id", userId);
  return error ? { error: entraideError(error) } : { success: true };
}

export async function deleteReply(
  db: Db,
  userId: string,
  id: number,
): Promise<ActionResult> {
  const { error } = await db
    .from("entraide_replies")
    .update({ status: "deleted" })
    .eq("id", id)
    .eq("author_id", userId);
  return error ? { error: entraideError(error) } : { success: true };
}
