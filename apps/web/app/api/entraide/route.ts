import type { ActionResult } from "@finance/core/action-result";
import type { PostKind } from "@finance/core/entraide";
import * as write from "@/lib/entraide-write";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Entraide's writes from the phone: the same `lib/entraide-write.ts` the
 * web's actions run — masked, checked, kept with who wrote them and from
 * where, pushed to whoever they concern — as the bearer token's person.
 * The phone reads Entraide itself, through the public RPCs; only what it
 * writes comes here, so that nothing is written past these rules.
 *
 * One route, the write named by `action`.
 */

export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";

const id = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;

const optional = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const INVALID = { error: "errors.invalidInput" } as const;

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Body;
  const db = session.supabase;
  const writer = { id: session.userId, email: session.email };

  let result: ActionResult<object>;
  switch (body.action) {
    case "post":
      result = await write.writePost(db, writer, {
        kind: text(body.kind) as PostKind,
        title: text(body.title),
        body: text(body.body),
        handle: optional(body.handle),
        guideSlug: optional(body.guideSlug) ?? null,
      });
      break;
    case "editPost": {
      const post = id(body.id);
      result = post
        ? await write.changePost(db, writer, post, {
            title: text(body.title),
            body: text(body.body),
          })
        : INVALID;
      break;
    }
    case "deletePost": {
      const post = id(body.id);
      result = post ? await write.removePost(db, writer, post) : INVALID;
      break;
    }
    case "reply": {
      const post = id(body.postId);
      result = post
        ? await write.writeReply(
            db,
            writer,
            post,
            text(body.text),
            optional(body.handle),
          )
        : INVALID;
      break;
    }
    case "editReply": {
      const reply = id(body.id);
      result = reply
        ? await write.changeReply(db, writer, reply, text(body.text))
        : INVALID;
      break;
    }
    case "deleteReply": {
      const reply = id(body.id);
      result = reply ? await write.removeReply(db, writer, reply) : INVALID;
      break;
    }
    case "solve": {
      const post = id(body.postId);
      const reply = body.replyId === null ? null : id(body.replyId);
      result =
        post && (reply !== null || body.replyId === null)
          ? await write.settle(db, writer, post, reply)
          : INVALID;
      break;
    }
    case "report":
      result = await write.report(
        db,
        writer,
        text(body.target),
        text(body.reason),
        text(body.note),
      );
      break;
    default:
      result = INVALID;
  }
  return Response.json(result);
}
