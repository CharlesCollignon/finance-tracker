import { z } from "zod";

import {
  DRAIN_COOLDOWN_SECONDS,
  readInstrument,
} from "@/lib/instrument-reading/read";
import { gatherLookThrough } from "@/lib/wallet-read/facts";
import { sessionFromBearer } from "@/lib/supabase/bearer";

/**
 * Read one instrument.
 *
 * One per request, deliberately. A portfolio of twenty unread positions is
 * twenty requests, which is visible progress rather than one call the
 * platform kills at sixty seconds with the allowance already spent.
 *
 * The body is optional. With no ISIN the queue picks the one most worth
 * reading, which is what the surface does; with one, that instrument is read
 * if the caller actually holds it — a check `reserve_instrument_reading`
 * enforces in the database rather than here, so a forged body cannot get
 * past it.
 *
 * Refusals are 200s with a reason, and no CORS headers, for the reasons the
 * other bearer routes record.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    isin: z
      .string()
      .regex(/^[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]$/)
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return Response.json({ error: "Invalid ISIN" }, { status: 400 });
  }

  try {
    const bundle = await gatherLookThrough(session.userId, session.supabase);
    const isin = parsed.data.isin?.toUpperCase() ?? bundle.queue[0];

    if (isin === undefined) {
      return Response.json({ status: "nothing-to-read", remaining: 0 });
    }

    const item = bundle.portfolio.columns
      .flatMap((column) => column.items)
      .find((row) => row.isin === isin);

    const outcome = await readInstrument(
      session.userId,
      isin,
      item?.name ?? isin,
      item?.instrumentSymbol ?? null,
      // No quiet period, for the same reason the web action passes none: the
      // phone walks its queue a request at a time and would otherwise be
      // refused on every request after the first.
      { client: session.supabase, cooldownSeconds: DRAIN_COOLDOWN_SECONDS },
    );

    return Response.json({
      status: outcome.status,
      remaining: Math.max(0, bundle.queue.length - 1),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "That instrument could not be read just now.",
      },
      { status: 502 },
    );
  }
}
