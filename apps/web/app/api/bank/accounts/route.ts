import { discoverAccounts } from "@/lib/bank/discover";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Look for accounts from the phone — after the user added a bank on
 * open-banking.io — and bring nothing in: the same `discoverAccounts` the
 * web's « Ajouter une banque » runs. What comes back is how many readable
 * accounts wait to be told what they are.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  const result = await discoverAccounts(session.supabase, session.userId);
  return Response.json(result, { status: result.error ? 502 : 200 });
}
