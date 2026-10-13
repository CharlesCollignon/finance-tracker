import "server-only";

import { threadHref } from "@finance/core/entraide";
import { translator } from "@finance/core/i18n/t";
import {
  entraideAnswerNotification,
  entraideSolvedNotification,
} from "@finance/core/push-messages";
import type { PendingNotification } from "@finance/core/push-digest";
import { readRecipients } from "@finance/data/preferences";
import { deliver } from "@/lib/push/deliver";
import { configureWebPush } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Entraide's two pushes, said as they happen rather than by a cron: an
 * answer to someone's question, and someone's answer marked « Résolu ».
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
