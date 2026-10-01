import { disconnectUserBank } from "@/lib/bank/service";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Disconnect from the phone: revoke the key at open-banking.io, forget it
 * here, and keep or take back what the bank brought in — the same
 * `disconnectUserBank` the web's action runs.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    deleteImported?: unknown;
  };
  const result = await disconnectUserBank(session.userId, {
    // Keeping is the default, so only an explicit true deletes anything.
    deleteImported: body.deleteImported === true,
  });
  return Response.json(result);
}
