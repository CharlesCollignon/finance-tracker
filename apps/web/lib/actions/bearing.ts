"use server";

import { revalidatePath } from "next/cache";
import type { TilePins } from "@finance/core/bearing-tiles";
import { bearingPinsRequestSchema } from "@finance/core/validations/bearing";
import { getAuthUser } from "@/lib/auth/get-user";
import { arrangeBearing, type ArrangeOutcome } from "@/lib/bearing/write";
import { writePins } from "@/lib/bearing/store";

/**
 * Ask a model to rearrange the Bearing.
 *
 * The same split the bank refresh and the month read use: a server action for
 * the web, a bearer route for the phone, one shared implementation
 * underneath. Only the Bearing is revalidated — an arrangement changes
 * nothing anywhere else.
 */
export async function arrangeBearingAction(): Promise<ArrangeOutcome> {
  const user = await getAuthUser();
  if (!user) {
    return {
      arranged: false,
      message: "errors.notAuthenticated",
      arrangementsLeft: 0,
    };
  }

  const outcome = await arrangeBearing(user.id);

  if (outcome.arranged) {
    revalidatePath("/bearing");
  }

  return outcome;
}

/**
 * Remember where the user put their tiles.
 *
 * No revalidation on purpose. The grid has already moved the tile under the
 * pointer — that is what dragging means — and re-rendering the server
 * component would replace a settled layout with an identical one, which on a
 * touch screen reads as a flicker at the exact moment the user let go. The
 * row is written so the next load agrees; this load already does.
 */
export async function saveBearingPinsAction(
  pins: TilePins,
): Promise<{ saved: boolean }> {
  const user = await getAuthUser();
  if (!user) {
    return { saved: false };
  }

  const parsed = bearingPinsRequestSchema.safeParse({ pins });
  if (!parsed.success) {
    return { saved: false };
  }

  await writePins(user.id, parsed.data.pins);
  return { saved: true };
}

/** Hand the surface back to whatever the arrangement says. */
export async function clearBearingPinsAction(): Promise<{ saved: boolean }> {
  const user = await getAuthUser();
  if (!user) {
    return { saved: false };
  }

  await writePins(user.id, {});
  revalidatePath("/bearing");
  return { saved: true };
}
