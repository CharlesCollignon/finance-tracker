import {
  importOneAccount,
  listAccountsToImport,
} from "@/lib/bank/first-import";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * The phone's first import, one account per request: the list to walk, then
 * each account's history. The same bodies as the web's actions — see
 * `lib/bank/first-import` — so an import started on one finishes the same way
 * on the other.
 */

// One account's whole history is the slow part; sixty seconds is the Hobby
// ceiling, and one account is sized to fit it.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const result = await listAccountsToImport(session.userId);
  return Response.json(result, { status: result.error ? 502 : 200 });
}

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    accountId?: unknown;
  };
  const accountId = body.accountId;
  if (typeof accountId !== "string" || !accountId || accountId.length > 200) {
    return Response.json({ error: "Invalid selection" }, { status: 400 });
  }
  const result = await importOneAccount(
    session.supabase,
    session.userId,
    accountId,
  );
  return Response.json(result, { status: result.error ? 502 : 200 });
}
