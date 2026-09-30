import { bankSetupOfferedThrough } from "@/lib/bank/offer";
import { connectUserBankFile } from "@/lib/bank/service";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * The phone's way to hand over a credentials file: POST `{ text }`, the
 * file's contents, with the session's bearer token. The same intake as the
 * web's `connectBankFile`, and the same flag check, through the phone's own
 * session.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await bankSetupOfferedThrough(session.supabase))) {
    return Response.json({ error: "bankConnect.unavailable" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: unknown };
  const result = await connectUserBankFile(session.userId, body.text);
  return Response.json(result, { status: result.error ? 400 : 200 });
}
