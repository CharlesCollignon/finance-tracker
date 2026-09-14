import { sessionFromBearer } from "@/lib/supabase/bearer";
import { writeWalletRead } from "@/lib/wallet-read/write";

/**
 * The phone's way of asking for a wallet read.
 *
 * Shares `lib/wallet-read/write.ts` with the server action the web surface
 * presses, which is what keeps one order of operations and one set of words
 * across the two clients.
 *
 * Every refusal is a 200 with a reason. The look-through is still perfectly
 * usable without a read — it is arithmetic the app did itself — so none of
 * these is an error a client should retry.
 *
 * No CORS headers, on purpose: a native client is not subject to them, and
 * adding them would open this to any web origin holding a token.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const outcome = await writeWalletRead(session.userId, session.supabase);
    return Response.json(outcome);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The wallets could not be read just now.",
      },
      { status: 502 },
    );
  }
}
