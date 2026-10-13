import "server-only";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ActionResult } from "@finance/core/action-result";
import {
  ENTRAIDE_HREF,
  ENTRAIDE_LIMITS,
  entraideTargetOf,
  handleProblem,
  isEntraideRule,
  threadHref,
  type EntraideTarget,
  type PostKind,
} from "@finance/core/entraide";
import { maskPersonalData } from "@finance/core/entraide-mask";
import type { Db } from "@finance/data/client";
import * as entraide from "@finance/data/entraide";
import { pushAnswer, pushReport, pushSolved } from "@/lib/entraide-push";
import { recordAuthorship } from "@/lib/entraide-authorship";
import { isGuideSlug } from "@/lib/guide-list";
import { entraideRulesVisible } from "@/components/marketing/legal-status";

/**
 * Entraide's writes, whoever asks: the web's actions with the cookie
 * session (`lib/actions/entraide.ts`), the phone with its bearer token
 * (`app/api/entraide/route.ts`). Each one is the writer's own — `db` acts
 * as them — masked before it is saved (`maskPersonalData`, which the form's
 * preview has already shown), and refused while Entraide is closed: it
 * opens with its rules (`ENTRAIDE_RULES_DRAFT`). What the database refuses
 * comes back by name (`entraideError`), for the form to say in words.
 *
 * What was written is kept a year with who wrote it and from where
 * (`recordAuthorship`); an answer, and an answer marked « Résolu », are
 * pushed to whoever they concern once the reply has gone back
 * (`lib/entraide-push.ts`). The list and the thread are marked stale, for
 * the router's cache.
 */

export interface EntraideWriter {
  id: string;
  email: string | null;
}

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

/**
 * A new question or share, with the pseudonym chosen on the way if this is
 * the writer's first. Answers with what was saved, masked.
 */
export async function writePost(
  db: Db,
  writer: EntraideWriter,
  input: {
    kind: PostKind;
    title: string;
    body: string;
    handle?: string;
    guideSlug?: string | null;
  },
): Promise<
  ActionResult<{ id: number; title: string; body: string; handle: string }>
> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const title = maskPersonalData(input.title).text.trim();
  const body = maskPersonalData(input.body).text.trim();
  if (
    (input.kind !== "question" && input.kind !== "share") ||
    !fits(title, ENTRAIDE_LIMITS.titleMin, ENTRAIDE_LIMITS.titleMax) ||
    body.length > ENTRAIDE_LIMITS.bodyMax
  ) {
    return { error: "errors.invalidInput" };
  }
  const named = await ensureHandle(db, writer.id, input.handle);
  if ("error" in named) {
    return { error: named.error };
  }
  const created = await entraide.createPost(db, writer.id, {
    kind: input.kind,
    title,
    body,
    guideSlug:
      input.guideSlug && isGuideSlug(input.guideSlug) ? input.guideSlug : null,
  });
  if (!created.success) {
    return { error: created.error };
  }
  redraw();
  await recordAuthorship(`post:${created.id}`, "create", writer);
  return {
    success: true,
    id: created.id,
    title,
    body,
    handle: named.handle,
  };
}

export async function changePost(
  db: Db,
  writer: EntraideWriter,
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
  const result = await entraide.editPost(db, writer.id, id, { title, body });
  if (result.success) {
    redraw(threadHref(id, title));
    await recordAuthorship(`post:${id}`, "edit", writer);
  }
  return result;
}

export async function removePost(
  db: Db,
  writer: EntraideWriter,
  id: number,
): Promise<ActionResult> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const result = await entraide.deletePost(db, writer.id, id);
  if (result.success) {
    redraw();
    await recordAuthorship(`post:${id}`, "delete", writer);
  }
  return result;
}

/** An answer to a thread. */
export async function writeReply(
  db: Db,
  writer: EntraideWriter,
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
  const named = await ensureHandle(db, writer.id, handle);
  if ("error" in named) {
    return { error: named.error };
  }
  const result = await entraide.createReply(db, writer.id, postId, body);
  if (result.success) {
    redraw();
    const replyId = result.id;
    await recordAuthorship(`reply:${replyId}`, "create", writer);
    after(() => pushAnswer(replyId));
  }
  return result;
}

export async function changeReply(
  db: Db,
  writer: EntraideWriter,
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
  const result = await entraide.editReply(db, writer.id, id, body);
  if (result.success) {
    await recordAuthorship(`reply:${id}`, "edit", writer);
  }
  return result;
}

export async function removeReply(
  db: Db,
  writer: EntraideWriter,
  id: number,
): Promise<ActionResult> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const result = await entraide.deleteReply(db, writer.id, id);
  if (result.success) {
    redraw();
    await recordAuthorship(`reply:${id}`, "delete", writer);
  }
  return result;
}

/** The asker marks an answer « Résolu », or takes the mark back (`null`). */
export async function settle(
  db: Db,
  writer: EntraideWriter,
  postId: number,
  replyId: number | null,
): Promise<ActionResult> {
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  const result = await entraide.markSolved(db, writer.id, postId, replyId);
  if (result.success) {
    redraw();
    if (replyId !== null) {
      after(() => pushSolved(postId));
    }
  }
  return result;
}

/**
 * « Signaler »: a member reports a question or an answer, with the rule it
 * breaks. The moderators hear of it; a third report hides it at once
 * (migration 072), and its author hears too.
 */
export async function report(
  db: Db,
  writer: EntraideWriter,
  target: string,
  reason: string,
  note: string,
): Promise<ActionResult> {
  const reported: EntraideTarget | null = entraideTargetOf(target);
  if (!entraideRulesVisible()) {
    return CLOSED;
  }
  if (!reported || !isEntraideRule(reason)) {
    return { error: "errors.invalidInput" };
  }
  const result = await entraide.reportContent(
    db,
    writer.id,
    reported,
    reason,
    note,
  );
  if (result.success && result.id !== null) {
    const reportId = result.id;
    after(() => pushReport(reportId, reported));
    redraw();
  }
  return result.success ? { success: true } : { error: result.error };
}
