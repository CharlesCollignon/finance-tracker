"use server";

import { revalidatePath } from "next/cache";
import { isDesign } from "@finance/core/designs";
import type { ActionResult } from "@finance/core/action-result";
import * as preferences from "@finance/data/preferences";
import { asUser } from "@/lib/actions/as-user";
import { writeDesignCookie } from "@/lib/design-cookies";
import { getLocale } from "@/lib/locale";

/**
 * Read Pluclair in this design, from the profile.
 *
 * The cookie first, then the row, the way the language does it: the cookie
 * is what the next request paints with, so a row that fails to write still
 * leaves this browser in the design just picked, and the profile can write
 * the row again.
 */
export async function setDesignPreference(
  design: string,
): Promise<ActionResult> {
  if (!isDesign(design)) {
    return { error: "errors.invalidInput" };
  }
  await writeDesignCookie(design);
  const locale = await getLocale();
  const result = await asUser(
    (db, userId) => preferences.setDesign(db, userId, design, locale),
    { redraw: "never" },
  );
  // The root layout paints the design onto <html>, so every page is stale.
  revalidatePath("/", "layout");
  return result;
}
