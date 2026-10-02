import {
  fileFeedItems,
  leaveOutFeedItems,
  reopenFeedItems,
} from "@finance/data/feed-decisions";
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
  };

  const result =
    body.action === "import"
      ? await fileFeedItems(
          session.supabase,
          session.userId,
          body.ids,
          body.categoryId,
        )
      : body.action === "ignore"
        ? await leaveOutFeedItems(session.supabase, session.userId, body.ids)
        : body.action === "undo"
          ? await reopenFeedItems(session.supabase, session.userId, body.ids)
          : { error: "errors.invalidInput" };

  return Response.json(result, { status: result.error ? 400 : 200 });
}
