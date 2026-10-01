import { recordUserBankConsent } from "@/lib/bank/service";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * The phone's way to give today's consent on an existing connection: POST
 * `{ consentVersion }` with the session's bearer token. The web's
 * `confirmBankConsent`, through the same service function.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    consentVersion?: unknown;
  };
  const result = await recordUserBankConsent(
    session.userId,
    body.consentVersion,
  );
  return Response.json(result, { status: result.error ? 400 : 200 });
}
