"use server";

import type { ActionResult } from "@finance/core/action-result";
import * as preferences from "@finance/data/preferences";
import { asUser } from "@/lib/actions/as-user";
import { getLocale } from "@/lib/locale";

/**
 * Remember the milestone the Plan has just celebrated, on every device.
 *
 * No redraw: nothing on any page reads it but the Plan, which already shows
 * the celebration — and a redraw would hand it the new figure and take the
 * "new" badge away a second after it appeared.
 */
export async function markMilestoneSeen(amount: number): Promise<ActionResult> {
  const locale = await getLocale();
  return asUser(
    (db, userId) => preferences.markMilestoneSeen(db, userId, amount, locale),
    { redraw: "never" },
  );
}
