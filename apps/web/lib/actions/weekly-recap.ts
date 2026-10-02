"use server";

import type { ActionResult } from "@finance/core/action-result";
import { mondayOf } from "@finance/core/weekly-recap";
import * as recap from "@finance/data/weekly-recap";
import { asUser } from "@/lib/actions/as-user";
import { getLocale } from "@/lib/locale";

/** Put this week's recap card away, on every device. */
export async function dismissWeeklyRecap(
  weekOf: string,
): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf) || mondayOf(weekOf) !== weekOf) {
    return { error: "errors.invalidInput" };
  }
  const locale = await getLocale();
  return asUser((db, userId) =>
    recap.dismissWeeklyRecap(db, userId, weekOf, locale),
  );
}
