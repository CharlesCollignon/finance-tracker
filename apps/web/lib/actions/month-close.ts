"use server";

import type { ActionResult } from "@finance/core/action-result";
import type { MonthCloseResult, RunMoment } from "@finance/core/month-close";
import * as closing from "@finance/data/closing";
import { asUser } from "@/lib/actions/as-user";
import { getAuthUser } from "@/lib/auth/get-user";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

/**
 * Closing a month — the writes are `@finance/data/closing`, shared with the
 * phone. The dry run writes nothing, so it does not redraw anything either.
 */

export async function previewMonthCloseAction(
  year: number,
  month: number,
  closingBalance: number,
): Promise<ActionResult<{ result: MonthCloseResult }>> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  return closing.previewClose(
    await createClient(),
    user.id,
    year,
    month,
    closingBalance,
  );
}

export async function recordMonthClose(
  year: number,
  month: number,
  closingBalance: number,
): Promise<ActionResult<{ result: MonthCloseResult; run: RunMoment | null }>> {
  const locale = await getLocale();
  return asUser((db, userId) =>
    closing.recordMonthClose(db, userId, year, month, closingBalance, locale),
  );
}

export async function deleteMonthClose(
  year: number,
  month: number,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    closing.deleteMonthClose(db, userId, year, month),
  );
}

export async function updateUnrecordedCap(
  cap: number | null,
): Promise<ActionResult> {
  return asUser((db, userId) => closing.updateUnrecordedCap(db, userId, cap));
}

export async function updateCloseDay(closeDay: number): Promise<ActionResult> {
  return asUser((db, userId) => closing.updateCloseDay(db, userId, closeDay));
}
