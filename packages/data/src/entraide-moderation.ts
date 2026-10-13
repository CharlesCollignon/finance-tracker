import type { ActionResult } from "@finance/core/action-result";
import type {
  EntraideRule,
  EntraideStatus,
  EntraideTarget,
  PostKind,
} from "@finance/core/entraide";

import type { Db } from "./client";
import { dbError } from "./errors";

/**
 * Entraide's moderation (migration 072), for the moderator only: every
 * function here takes the service role's client, which the web hands over
 * only after checking `community.moderate`. It reads who wrote what — which
 * nothing else does — and writes the decisions and their reasons.
 */

export interface ModerationReport {
  id: number;
  reporterId: string | null;
  reason: EntraideRule;
  note: string;
  createdAt: string;
}

/** One reported thing, with its open reports, as the queue shows it. */
export interface ModerationItem {
  target: EntraideTarget;
  kind: "post" | "reply";
  postKind: PostKind | null;
  /** The thread it is in: its id and title, for the link. */
  threadId: number;
  threadTitle: string;
  /** The words reported: a post's title and text, or an answer's text. */
  title: string;
  body: string;
  status: EntraideStatus;
  author: {
    id: string | null;
    handle: string | null;
    email: string | null;
    barred: boolean;
  };
  reports: ModerationReport[];
  /** Hidden by three reports, and not looked at yet. */
  automaticallyHidden: boolean;
}

function idOf(target: EntraideTarget): number {
  return Number(target.split(":")[1]);
}

/** Every reported thing nobody has decided on yet, the oldest report first. */
export async function readModerationQueue(
  admin: Db,
): Promise<ModerationItem[]> {
  const { data: reports, error } = await admin
    .from("entraide_reports")
    .select("id, target, reporter_id, reason, note, created_at")
    .is("resolved_at", null)
    .order("created_at");
  if (error) {
    throw error;
  }
  const byTarget = new Map<EntraideTarget, ModerationReport[]>();
  for (const row of reports ?? []) {
    const target = row.target as EntraideTarget;
    byTarget.set(target, [
      ...(byTarget.get(target) ?? []),
      {
        id: row.id,
        reporterId: row.reporter_id,
        reason: row.reason as EntraideRule,
        note: row.note,
        createdAt: row.created_at,
      },
    ]);
  }

  const targets = [...byTarget.keys()];
  const postIds = targets.filter((t) => t.startsWith("post:")).map(idOf);
  const replyIds = targets.filter((t) => t.startsWith("reply:")).map(idOf);
  const [posts, replies] = await Promise.all([
    postIds.length
      ? admin
          .from("entraide_posts")
          .select("id, kind, title, body, status, author_id")
          .in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
    replyIds.length
      ? admin
          .from("entraide_replies")
          .select("id, post_id, body, status, author_id")
          .in("id", replyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (posts.error) throw posts.error;
  if (replies.error) throw replies.error;

  const threadIds = [...new Set((replies.data ?? []).map((r) => r.post_id))];
  const { data: threads } = threadIds.length
    ? await admin.from("entraide_posts").select("id, title").in("id", threadIds)
    : { data: [] as { id: number; title: string }[] };
  const titleOf = new Map((threads ?? []).map((t) => [t.id, t.title]));

  const authorIds = [
    ...new Set(
      [...(posts.data ?? []), ...(replies.data ?? [])]
        .map((row) => row.author_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: profiles } = authorIds.length
    ? await admin
        .from("entraide_profiles")
        .select("user_id, handle, banned_at")
        .in("user_id", authorIds)
    : {
        data: [] as {
          user_id: string;
          handle: string;
          banned_at: string | null;
        }[],
      };
  const profileOf = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const emails = new Map<string, string | null>();
  await Promise.all(
    authorIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      emails.set(id, data.user?.email ?? null);
    }),
  );

  const author = (id: string | null) => {
    const profile = id ? profileOf.get(id) : undefined;
    return {
      id,
      handle: profile?.handle ?? null,
      email: id ? (emails.get(id) ?? null) : null,
      barred: Boolean(profile?.banned_at),
    };
  };
  const reporters = (list: ModerationReport[]) =>
    new Set(list.map((report) => report.reporterId).filter(Boolean)).size;

  const items: ModerationItem[] = [];
  for (const post of posts.data ?? []) {
    const target: EntraideTarget = `post:${post.id}`;
    const list = byTarget.get(target) ?? [];
    items.push({
      target,
      kind: "post",
      postKind: post.kind as PostKind,
      threadId: post.id,
      threadTitle: post.title,
      title: post.title,
      body: post.body,
      status: post.status as EntraideStatus,
      author: author(post.author_id),
      reports: list,
      automaticallyHidden: post.status === "hidden" && reporters(list) >= 3,
    });
  }
  for (const reply of replies.data ?? []) {
    const target: EntraideTarget = `reply:${reply.id}`;
    const list = byTarget.get(target) ?? [];
    items.push({
      target,
      kind: "reply",
      postKind: null,
      threadId: reply.post_id,
      threadTitle: titleOf.get(reply.post_id) ?? "",
      title: "",
      body: reply.body,
      status: reply.status as EntraideStatus,
      author: author(reply.author_id),
      reports: list,
      automaticallyHidden: reply.status === "hidden" && reporters(list) >= 3,
    });
  }
  const first = (item: ModerationItem) => item.reports[0]?.createdAt ?? "";
  return items.sort((a, b) => first(a).localeCompare(first(b)));
}

export type ModerationAction =
  | {
      action: "hide";
      target: EntraideTarget;
      rule: EntraideRule;
      facts: string;
    }
  | { action: "keep"; target: EntraideTarget }
  | { action: "bar"; authorId: string; rule: EntraideRule; facts: string }
  | { action: "unbar"; authorId: string };

/** What a decision changed: whom to tell, and about what. */
export interface ModerationOutcome {
  /** The author, told of a measure against them; null when none was taken. */
  authorId: string | null;
  decisionId: number | null;
  /** The reports it settled, and who made them. */
  settled: { id: number; reporterId: string | null }[];
  hidden: boolean;
}

async function authorOf(
  admin: Db,
  target: EntraideTarget,
): Promise<{ authorId: string | null; status: EntraideStatus } | null> {
  const table = target.startsWith("post:")
    ? "entraide_posts"
    : "entraide_replies";
  const { data } = await admin
    .from(table)
    .select("author_id, status")
    .eq("id", idOf(target))
    .maybeSingle();
  return data
    ? { authorId: data.author_id, status: data.status as EntraideStatus }
    : null;
}

/**
 * A moderator's decision. « Masquer » hides and settles the reports as
 * hidden — or, on what three reports had hidden, confirms it with the
 * moderator's own reason; « Garder » settles them as kept and, if three
 * reports had hidden it, shows it again; a pseudonym is barred or let back. Every measure that
 * restricts or lifts a restriction is a decision row its author reads.
 */
export async function decide(
  admin: Db,
  decision: ModerationAction,
): Promise<ActionResult<{ outcome: ModerationOutcome }>> {
  if (decision.action === "bar" || decision.action === "unbar") {
    const { error } = await admin
      .from("entraide_profiles")
      .update({
        banned_at: decision.action === "bar" ? new Date().toISOString() : null,
      })
      .eq("user_id", decision.authorId);
    if (error) {
      return { error: dbError(error) };
    }
    const { data, error: written } = await admin
      .from("entraide_decisions")
      .insert({
        author_id: decision.authorId,
        action: decision.action,
        rule: decision.action === "bar" ? decision.rule : "none",
        facts: decision.action === "bar" ? decision.facts.trim() : "",
      })
      .select("id")
      .single();
    if (written || !data) {
      return { error: written ? dbError(written) : "errors.couldNotSave" };
    }
    return {
      success: true,
      outcome: {
        authorId: decision.authorId,
        decisionId: data.id,
        settled: [],
        hidden: false,
      },
    };
  }

  const found = await authorOf(admin, decision.target);
  if (!found) {
    return { error: "errors.notFound" };
  }
  const hide = decision.action === "hide";
  const table = decision.target.startsWith("post:")
    ? "entraide_posts"
    : "entraide_replies";
  // A post deleted meanwhile, or an account gone, stays as it is.
  const changes = hide ? found.status === "visible" : found.status === "hidden";
  if (changes && found.authorId) {
    const { error } = await admin
      .from(table)
      .update({ status: hide ? "hidden" : "visible" })
      .eq("id", idOf(decision.target));
    if (error) {
      return { error: dbError(error) };
    }
  }

  const { data: settled, error: settling } = await admin
    .from("entraide_reports")
    .update({
      resolved_at: new Date().toISOString(),
      outcome: hide ? "hidden" : "kept",
    })
    .eq("target", decision.target)
    .is("resolved_at", null)
    .select("id, reporter_id");
  if (settling) {
    return { error: dbError(settling) };
  }

  // A decision is written when the status changed — or when a moderator
  // confirms, with their own rule and facts, what three reports had hidden.
  const confirmed = hide && found.status === "hidden";
  let decisionId: number | null = null;
  if ((changes || confirmed) && found.authorId) {
    const { data, error } = await admin
      .from("entraide_decisions")
      .insert({
        target: decision.target,
        author_id: found.authorId,
        action: hide ? "hide" : "restore",
        rule: hide ? decision.rule : "none",
        facts: hide ? decision.facts.trim() : "",
        from_report: (settled ?? []).length > 0,
      })
      .select("id")
      .single();
    if (error || !data) {
      return { error: error ? dbError(error) : "errors.couldNotSave" };
    }
    decisionId = data.id;
  }

  return {
    success: true,
    outcome: {
      authorId: changes || confirmed ? found.authorId : null,
      decisionId,
      settled: (settled ?? []).map((row) => ({
        id: row.id,
        reporterId: row.reporter_id,
      })),
      hidden: hide,
    },
  };
}
