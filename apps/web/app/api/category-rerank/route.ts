import { rerankFindings } from "@/lib/category-selection/write";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Asking a model which findings should lead, for a client that cannot hold
 * the key — `api/category-read`'s sibling.
 *
 * Takes nothing: the findings are rebuilt from the database inside, because
 * a catalogue the client supplied is a catalogue the client chose.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }

  const outcome = await rerankFindings(session.userId, session.supabase);
  return Response.json(outcome);
}
