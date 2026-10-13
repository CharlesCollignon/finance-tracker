import type {
  EntraideDecision,
  EntraideFilter,
  EntraideMatch,
  EntraidePost,
  EntraidePostSummary,
  EntraideReply,
  EntraideSort,
  PostKind,
} from "@finance/core/entraide";
import { postTarget, replyTarget } from "@finance/core/reactions";
import * as entraide from "@finance/data/entraide";

import { supabase } from "@/lib/supabase";
import { callWebApi } from "@/lib/web-api";

/**
 * Entraide on the phone. It reads as anyone reads it — the public RPCs,
 * through this device's session, so the reader's own messages, hidden ones
 * included, come back marked as on the site — and writes through the web
 * (`/api/entraide`), so that what it writes is masked, checked and kept
 * with who wrote it exactly as the site's own forms are.
 */

/** A page of the list. */
export const PAGE = 20;

export function readList(
  filter: EntraideFilter,
  sort: EntraideSort,
  offset: number,
): Promise<EntraidePostSummary[]> {
  return entraide.readEntraideList(supabase, {
    filter,
    sort,
    offset,
    limit: PAGE,
  });
}

interface ThreadRead {
  post: EntraidePost;
  replies: EntraideReply[];
  /** The reader's pseudonym, or null before their first message. */
  handle: string | null;
  /** What the reader has reported here already. */
  reported: ReadonlySet<string>;
  /** Why a message of the reader's is hidden, by target. */
  decisions: ReadonlyMap<string, EntraideDecision>;
}

/** A thread, with what only its reader sees about it. Null if there is none. */
export async function readThreadFor(
  id: number,
  userId: string | null,
): Promise<ThreadRead | null> {
  // The pseudonym needs nothing from the thread: read alongside it.
  const [thread, handle] = await Promise.all([
    entraide.readThread(supabase, id),
    userId
      ? entraide.readMyHandle(supabase, userId).catch(() => null)
      : Promise.resolve(null),
  ]);
  if (!thread) {
    return null;
  }
  const { post, replies } = thread;
  const targets = [
    postTarget(post.id),
    ...replies.map((reply) => replyTarget(reply.id)),
  ];
  const myHidden = [
    ...(post.author.isMine && post.status === "hidden"
      ? [postTarget(post.id)]
      : []),
    ...replies
      .filter((reply) => reply.author.isMine && reply.status === "hidden")
      .map((reply) => replyTarget(reply.id)),
  ];
  const [reported, decisions] = userId
    ? await Promise.all([
        entraide
          .readMyReports(supabase, userId, targets)
          .catch(() => new Set<string>()),
        myHidden.length > 0
          ? entraide
              .readMyDecisions(supabase, userId, myHidden)
              .catch(() => new Map<string, EntraideDecision>())
          : Promise.resolve(new Map<string, EntraideDecision>()),
      ])
    : [new Set<string>(), new Map<string, EntraideDecision>()];
  return { post, replies, handle, reported, decisions };
}

export function readMyHandle(userId: string): Promise<string | null> {
  return entraide.readMyHandle(supabase, userId).catch(() => null);
}

/** « Déjà demandé ? »: open threads close to what is being typed. */
export function searchAsked(query: string): Promise<EntraideMatch[]> {
  return query.trim().length < 3
    ? Promise.resolve([])
    : entraide.searchEntraide(supabase, query.slice(0, 200)).catch(() => []);
}

type EntraideWrite =
  | {
      action: "post";
      kind: PostKind;
      title: string;
      body: string;
      handle?: string;
    }
  | { action: "editPost"; id: number; title: string; body: string }
  | { action: "deletePost"; id: number }
  | { action: "reply"; postId: number; text: string; handle?: string }
  | { action: "editReply"; id: number; text: string }
  | { action: "deleteReply"; id: number }
  | { action: "solve"; postId: number; replyId: number | null }
  | { action: "report"; target: string; reason: string; note: string };

/**
 * One write, as the web's actions run it. The error is a key for
 * `entraideErrorText`; a web app that could not be reached reads as being
 * offline, since the words typed are still on the screen to send again.
 */
export async function writeEntraide<T extends object = object>(
  write: EntraideWrite,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const result = await callWebApi<T & { success?: boolean }>(
    "/api/entraide",
    { body: write, timeoutMs: 20_000 },
  );
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "bankConnect.unreachable"
          ? "errors.offline"
          : result.error,
    };
  }
  return { ok: true, value: result };
}
