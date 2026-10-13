import { inboxView } from "@/lib/statements/inbox";
import { getOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";

/**
 * The person's statements address and what waits from it, read by the
 * import while it waits for Gmail's code. A route, not a server action: a
 * page loaded before a deployment still reaches it, where a server action's
 * id from the older build is found nowhere and the code would never show.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await getOwner();
  if (!owner) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }
  return Response.json(await inboxView(await createClient(), owner.userId), {
    headers: { "cache-control": "no-store" },
  });
}
