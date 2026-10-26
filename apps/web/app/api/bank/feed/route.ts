import {
  fileFeedItems,
  leaveOutFeedItems,
  reopenFeedItems,
} from "@finance/data/feed-decisions";
import { addFilingRule } from "@finance/data/filing-rules";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * The phone's grouped review: file a group, leave it out, or take either
 * back — the bodies the web's batch actions run, so there is one duplicate
 * check for a bank row whichever app it was answered in.
 *
 * Through the phone's own session, not the service role: row level security
 * applies exactly as it does when the phone writes to Supabase directly.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    ids?: unknown;
    categoryId?: unknown;
    /** « Toujours ranger ici »: a rule written with the group (077). */
    rule?: { words?: unknown; direction?: unknown; createdFrom?: unknown };
  };

  const result =
    body.action === "import"
      ? await fileGroup(session.supabase, session.userId, body)
      : body.action === "ignore"
        ? await leaveOutFeedItems(session.supabase, session.userId, body.ids)
        : body.action === "undo"
          ? await reopenFeedItems(session.supabase, session.userId, body.ids)
          : { error: "errors.invalidInput" };

  return Response.json(result, { status: result.error ? 400 : 200 });
}

/**
 * File the group, then write the rule asked for with it, as the web's
 * `importFeedItems` does: the rule's refusal costs the rule, not the filing.
 */
async function fileGroup(
  supabase: Parameters<typeof fileFeedItems>[0],
  userId: string,
  body: {
    ids?: unknown;
    categoryId?: unknown;
    rule?: { words?: unknown; direction?: unknown; createdFrom?: unknown };
  },
) {
  const result = await fileFeedItems(supabase, userId, body.ids, body.categoryId);
  if (result.error || !body.rule || typeof body.categoryId !== "string") {
    return result;
  }
  const written = await addFilingRule(supabase, userId, {
    words: typeof body.rule.words === "string" ? body.rule.words : "",
    direction: body.rule.direction === "in" ? "in" : "out",
    createdFrom:
      typeof body.rule.createdFrom === "string"
        ? body.rule.createdFrom
        : undefined,
    categoryId: body.categoryId,
  });
  return { ...result, rule: written.success ? { words: written.words } : null };
}
