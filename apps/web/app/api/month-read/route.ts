import { monthReadRequestSchema } from "@finance/core/validations/month-read";
import { writeMonthRead } from "@/lib/month-read/write";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Writing a month read, for a client that cannot hold the key.
 *
 * Write-only, deliberately. The phone *reads* the stored row straight out of
 * Supabase like every other query — `month_reads` is select-own under row
 * level security — so there is no need for a route in that direction and no
 * round trip spent on one. The only thing the phone genuinely cannot do is
 * hold `MISTRAL_API_KEY`, which is what this exists for.
 *
 * Same shape as `api/bank/refresh`: the Supabase access token the phone
 * already has, verified here, with every query below carrying it so row
 * level security applies exactly as it does for a cookie session. No CORS
 * headers on purpose — a native client is not subject to them, and adding
 * them would open this to any web origin holding a token.
 */

// One model call. Sixty seconds is the ceiling a Hobby function gets, and the
// adapter's own timeout is well inside it.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = monthReadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid month" }, { status: 400 });
  }

  try {
    const outcome = await writeMonthRead(
      session.userId,
      parsed.data.year,
      parsed.data.month,
      session.supabase,
    );

    // Every refusal is a 200 with a reason. The read the app already holds is
    // still readable, so none of these is an error the client should retry.
    return Response.json(outcome);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not write the read.",
      },
      { status: 502 },
    );
  }
}
