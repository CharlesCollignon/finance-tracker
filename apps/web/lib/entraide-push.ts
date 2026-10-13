import "server-only";

import { threadHref, type EntraideTarget } from "@finance/core/entraide";
import { translator } from "@finance/core/i18n/t";
import {
  entraideAnswerNotification,
  entraideHiddenNotification,
  entraideReportNotification,
  entraideReportSettledNotification,
  entraideSolvedNotification,
} from "@finance/core/push-messages";
import type { ModerationOutcome } from "@finance/data/entraide-moderation";
import type { PendingNotification } from "@finance/core/push-digest";
import { readRecipients } from "@finance/data/preferences";
import { deliver } from "@/lib/push/deliver";
import { configureWebPush } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Entraide's pushes, said as they happen rather than by a cron: an answer
 * to someone's question, someone's answer marked « Résolu », a report to
 * the moderators, a hidden message to its author, and a decision to whoever
 * reported.
 * Through `deliver`, so the same rules hold as for every other push — the
 * `community` switch in Profile, the night's quiet hours (a push held then
 * is not sent later), and once per answer.
 *
 * Read with the service role: who wrote a post is never readable otherwise.
 * Best effort — a push that fails never fails the answer it is about.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function say(
  admin: Admin,
  userId: string,
  build: (voice: {
    t: ReturnType<typeof translator>;
    locale: "fr" | "en";
  }) => PendingNotification,
) {
  const recipient = (await readRecipients(admin, [userId])).get(userId);
  const locale = recipient?.locale ?? "fr";
  await deliver(
    admin,
    userId,
    recipient ?? { locale, prefs: {}, milestoneSeen: null },
    [build({ t: translator(locale), locale })],
    { webPushReady: configureWebPush() },
  );
}

/** Someone other than the asker answered: the asker hears who, and where. */
export async function pushAnswer(replyId: number): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    return;
  }
  try {
    const { data: reply } = await admin
      .from("entraide_replies")
      .select("author_id, post_id")
      .eq("id", replyId)
      .single();
    if (!reply?.author_id) {
      return;
    }
    const [{ data: post }, { data: writer }] = await Promise.all([
      admin
        .from("entraide_posts")
        .select("id, author_id, title, status")
        .eq("id", reply.post_id)
        .single(),
      admin
        .from("entraide_profiles")
        .select("handle")
        .eq("user_id", reply.author_id)
        .single(),
    ]);
    if (
      !post?.author_id ||
      post.status !== "visible" ||
      post.author_id === reply.author_id ||
      !writer
    ) {
      return;
    }
    await say(admin, post.author_id, (voice) =>
      entraideAnswerNotification({
        ...voice,
        replyId,
        handle: writer.handle,
        title: post.title,
        url: threadHref(post.id, post.title),
      }),
    );
  } catch (error) {
    console.warn("[entraide] answer push:", error);
  }
}

/** The asker marked an answer « Résolu »: its author hears it, once. */
export async function pushSolved(postId: number): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    return;
  }
  try {
    const { data: post } = await admin
      .from("entraide_posts")
      .select("id, author_id, title, solved_reply_id")
      .eq("id", postId)
      .single();
    if (!post?.solved_reply_id) {
      return;
    }
    const { data: reply } = await admin
      .from("entraide_replies")
      .select("author_id")
      .eq("id", post.solved_reply_id)
      .single();
    if (!reply?.author_id || reply.author_id === post.author_id) {
      return;
    }
    const replyId = post.solved_reply_id;
    await say(admin, reply.author_id, (voice) =>
      entraideSolvedNotification({
        ...voice,
        replyId,
        title: post.title,
        url: threadHref(post.id, post.title),
      }),
    );
  } catch (error) {
    console.warn("[entraide] solved push:", error);
  }
}

/** The thread a reported or decided thing is in: its title and address. */
async function threadOf(
  admin: Admin,
  target: EntraideTarget,
): Promise<{ title: string; url: string } | null> {
  const id = Number(target.split(":")[1]);
  let postId = id;
  if (target.startsWith("reply:")) {
    const { data } = await admin
      .from("entraide_replies")
      .select("post_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) {
      return null;
    }
    postId = data.post_id;
  }
  const { data: post } = await admin
    .from("entraide_posts")
    .select("id, title")
    .eq("id", postId)
    .maybeSingle();
  return post
    ? { title: post.title, url: threadHref(post.id, post.title) }
    : null;
}

/**
 * A report came in: the moderators hear of it. If it was the third and hid
 * the post, its author hears too — the reason is already on the message.
 */
export async function pushReport(
  reportId: number,
  target: EntraideTarget,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    return;
  }
  try {
    const [thread, moderators, decision, report] = await Promise.all([
      threadOf(admin, target),
      admin
        .from("user_feature_flags")
        .select("user_id")
        .eq("flag_key", "community.moderate")
        .eq("enabled", true),
      admin
        .from("entraide_decisions")
        .select("id, author_id, automatic, created_at")
        .eq("target", target)
        .eq("action", "hide")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("entraide_reports")
        .select("created_at")
        .eq("id", reportId)
        .maybeSingle(),
    ]);
    if (!thread) {
      return;
    }
    // Hidden by this very report: the decision was written in the same
    // transaction, so it carries the same instant.
    const hid =
      decision.data?.automatic === true &&
      report.data !== null &&
      decision.data.created_at === report.data.created_at;
    for (const { user_id: moderator } of moderators.data ?? []) {
      await say(admin, moderator, (voice) =>
        entraideReportNotification({
          ...voice,
          reportId,
          title: thread.title,
          hidden: hid,
        }),
      );
    }
    if (hid && decision.data) {
      const { id, author_id: author } = decision.data;
      await say(admin, author, (voice) =>
        entraideHiddenNotification({
          ...voice,
          decisionId: id,
          title: thread.title,
          url: thread.url,
        }),
      );
    }
  } catch (error) {
    console.warn("[entraide] report push:", error);
  }
}

/**
 * A moderator decided: the author hears of a measure against them, and
 * whoever reported hears what came of it.
 */
export async function pushDecision(
  outcome: ModerationOutcome,
  target: EntraideTarget,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    return;
  }
  try {
    const thread = await threadOf(admin, target);
    if (!thread) {
      return;
    }
    if (outcome.hidden && outcome.authorId && outcome.decisionId) {
      const decisionId = outcome.decisionId;
      await say(admin, outcome.authorId, (voice) =>
        entraideHiddenNotification({
          ...voice,
          decisionId,
          title: thread.title,
          url: thread.url,
        }),
      );
    }
    for (const report of outcome.settled) {
      if (!report.reporterId) {
        continue;
      }
      await say(admin, report.reporterId, (voice) =>
        entraideReportSettledNotification({
          ...voice,
          reportId: report.id,
          title: thread.title,
          hidden: outcome.hidden,
          url: outcome.hidden ? "/blog/entraide" : thread.url,
        }),
      );
    }
  } catch (error) {
    console.warn("[entraide] decision push:", error);
  }
}
