import { bankFeedStatus } from "@/lib/bank/client";
import { bankSetupOfferedThrough } from "@/lib/bank/offer";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * What only the server knows about the phone's bank: whether this user may
 * set one up here (the deployment can store one, and the `bank.connect` flag
 * is on for them), and whether the caller syncs on the deployment's own
 * credentials rather than a connection of their own.
 *
 * Everything else — the connection's status, its consent date, what was
 * dismissed — the phone reads from its own rows. These two live in the
 * server's environment, which is the point of keeping them there.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: row } = await session.supabase
    .from("bank_connections")
    .select("status")
    .eq("user_id", session.userId)
    .maybeSingle();

  return Response.json({
    available: await bankSetupOfferedThrough(session.supabase),
    ownerCredentials:
      !row && (await bankFeedStatus(session.userId)) === "connected",
  });
}
