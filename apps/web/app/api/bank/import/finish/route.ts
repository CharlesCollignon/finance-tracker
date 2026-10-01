import { finishFirstImport } from "@/lib/bank/first-import";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/** The phone's first import is done. See `finishFirstImport`. */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  return Response.json(
    await finishFirstImport(session.supabase, session.userId),
  );
}
