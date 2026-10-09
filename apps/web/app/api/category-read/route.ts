import { parseUuid } from "@finance/core/validations/finance";
import { writeCategoryRead } from "@/lib/category-read/write";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Writing a category read, for a client that cannot open the key.
 *
 * `api/month-read`'s twin, for the same reason: the phone reads stored reads
 * straight out of Supabase — `category_reads` is select-own under row level
 * security — and the only thing it cannot do is open the person's AI account
 * key, sealed with a server secret. The Supabase access token it already has
 * is verified here, and every query below carries it, so row level security
 * applies as for a cookie session.
 * No CORS headers on purpose: a native client is not subject to them.
 */

// One model call. Sixty seconds is the ceiling a Hobby function gets, and the
// adapter's own timeout is well inside it.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    categoryId?: unknown;
  } | null;
  const categoryId =
    typeof body?.categoryId === "string" ? parseUuid(body.categoryId) : null;
  if (!categoryId) {
    return Response.json({ error: "errors.invalidInput" }, { status: 400 });
  }

  // Every refusal is a 200 with a reason, as on the month read: the read the
  // app already holds is still readable, and none is worth retrying.
  const outcome = await writeCategoryRead(
    session.userId,
    categoryId,
    session.supabase,
  );
  return Response.json(outcome);
}
