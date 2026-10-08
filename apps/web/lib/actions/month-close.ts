"use server";

import { after } from "next/server";
import { recordActivity } from "@finance/data/activity";
import type { ActionResult } from "@finance/core/action-result";
import type { MonthCloseResult, RunMoment } from "@finance/core/month-close";
import * as closing from "@finance/data/closing";
import { asOwner } from "@/lib/actions/as-user";
import { getOwner } from "@/lib/owner";
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
  const owner = await getOwner();
  if (!owner) {
    return { error: "errors.notAuthenticated" };
  }
  return closing.previewClose(
    await createClient(),
    owner.ownerId,
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
  return asOwner(async (db, userId) => {
    const result = await closing.recordMonthClose(
      db,
      userId,
      year,
      month,
      closingBalance,
      locale,
    );
    if (result.success) {
      // Counted for the audience figures, after the answer is sent.
      after(() => recordActivity(db, "close"));
    }
    return result;
  });
}

export async function deleteMonthClose(
  year: number,
  month: number,
): Promise<ActionResult> {
  return asOwner((db, userId) =>
    closing.deleteMonthClose(db, userId, year, month),
  );
}

export async function updateUnrecordedCap(
  cap: number | null,
): Promise<ActionResult> {
  return asOwner((db, userId) => closing.updateUnrecordedCap(db, userId, cap));
}

export async function updateCloseDay(closeDay: number): Promise<ActionResult> {
  return asOwner((db, userId) => closing.updateCloseDay(db, userId, closeDay));
}
