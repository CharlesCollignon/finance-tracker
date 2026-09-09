import { bearingPinsRequestSchema } from "@finance/core/validations/bearing";
import { arrangeBearing } from "@/lib/bearing/write";
import { writePins } from "@/lib/bearing/store";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Arranging the Bearing, for a client that cannot hold the key.
 *
 * Write-only, deliberately. The phone *reads* the stored arrangement and its
 * own pins straight out of Supabase like every other query — both rows are
 * select-own under row level security — so there is no route in that
 * direction and no round trip spent on one. The only thing the phone
 * genuinely cannot do is hold `MISTRAL_API_KEY`, which is what POST exists
 * for.
 *
 * PUT is the exception to that reasoning, and worth stating why it is here
 * rather than a direct write from the phone: pins go in `user_preferences`,
 * which *is* client-writable, so the phone could update the column itself.
 * It goes through here anyway so that one validation — `tilePinsSchema`, over
 * the closed tile catalogue — stands between every client and that column,
 * rather than the web app validating and the phone being trusted.
 *
 * Same shape as `api/month-read`: the Supabase access token the phone already
 * has, verified here, with every query below carrying it so row level
 * security applies exactly as it does for a cookie session. No CORS headers
 * on purpose — a native client is not subject to them, and adding them would
 * open this to any web origin holding a token.
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

  try {
    const outcome = await arrangeBearing(session.userId, session.supabase);

    // Every refusal is a 200 with a reason. The surface is still perfectly
    // usable without an arrangement, so none of these is an error the client
    // should retry.
    return Response.json(outcome);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not arrange the Bearing.",
      },
      { status: 502 },
    );
  }
}

export async function PUT(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bearingPinsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid pins" }, { status: 400 });
  }

  try {
    await writePins(session.userId, parsed.data.pins, session.supabase);
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not save the order.",
      },
      { status: 502 },
    );
  }
}
