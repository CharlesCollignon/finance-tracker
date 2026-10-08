"use server";

import type { ActionResult } from "@finance/core/action-result";
import { yearReviewPrompt } from "@finance/core/year-review";
import { dismissPrompt } from "@finance/data/preferences";
import { asUser } from "@/lib/actions/as-user";
import { getLocale } from "@/lib/locale";

/** « Vu »: put « Votre année » away on Le point, on every device. */
export async function dismissYearReview(year: number): Promise<ActionResult> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "errors.invalidInput" };
  }
  const locale = await getLocale();
  return asUser((db, userId) =>
    dismissPrompt(db, userId, yearReviewPrompt(year), locale),
  );
}
