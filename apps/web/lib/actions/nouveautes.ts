"use server";

import type { ActionResult } from "@finance/core/action-result";
import * as preferences from "@finance/data/preferences";
import { asUser } from "@/lib/actions/as-user";
import { getLocale } from "@/lib/locale";

/**
 * « Nouveautés » has been read up to `entryId`: the dot in the account menu
 * goes, here and on the phone.
 *
 * No redraw: the page that calls it is the list itself, which has already
 * said what was new; the shell's dot is gone on the next page.
 */
export async function markNouveautesSeen(
  entryId: string,
): Promise<ActionResult> {
  const locale = await getLocale();
  return asUser(
    (db, userId) => preferences.markChangelogSeen(db, userId, entryId, locale),
    { redraw: "never" },
  );
}
