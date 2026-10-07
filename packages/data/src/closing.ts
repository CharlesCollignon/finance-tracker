import { firstIssue, type ActionResult } from "@finance/core/action-result";
import { formatLongDate, todayIsoLocal } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import {
  monthColumnValue,
  monthKeyOfClose,
  observationDateFor,
  runMoment,
  summarizeCloseHistory,
  type MonthCloseResult,
  type RunMoment,
} from "@finance/core/month-close";
import {
  closeDaySchema,
  monthCloseSchema,
  unrecordedCapSchema,
} from "@finance/core/validations/month-close";

import type { Db } from "./client";
import {
  getMonthCloseOverview,
  getMonthCloseSettings,
  previewMonthClose,
} from "./month-close";
import { dbError } from "./errors";

/**
 * Closing a month, for both apps: the dry run the sheet shows before the
 * user commits, recording the close, taking a mistyped one back, and the two
 * settings — the reading day and the unrecorded allowance.
 */

/**
 * What closing this month with this balance would say, without recording
 * it. The sheet shows the answer before the user commits, because a
 * reconciliation that lands as a surprise after an irreversible-feeling save
 * is a reason not to close next month.
 */
export async function previewClose(
  db: Db,
  userId: string,
  year: number,
  month: number,
  closingBalance: number,
): Promise<ActionResult<{ result: MonthCloseResult }>> {
  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  try {
    const result = await previewMonthClose(
      db,
      userId,
      parsed.data.year,
      parsed.data.month,
      parsed.data.closingBalance,
    );
    return { success: true, result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "monthClose.couldNotWorkOut",
    };
  }
}

/**
 * Record one month's closing balance.
 *
 * Refused before the reading day: the spending is still landing, and the
 * figure would be measured against a window that has not finished. Worked
 * out before writing, so a rejected reconciliation is never stored and the
 * reveal is the same figure the row will replay to.
 */
export async function recordMonthClose(
  db: Db,
  userId: string,
  year: number,
  month: number,
  closingBalance: number,
  locale: Locale,
): Promise<ActionResult<{ result: MonthCloseResult; run: RunMoment | null }>> {
  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const settings = await getMonthCloseSettings(db, userId);
  const observeOn = observationDateFor(
    parsed.data.year,
    parsed.data.month,
    settings.closeDay,
  );

  if (todayIsoLocal() < observeOn) {
    return {
      error: translator(locale)("actions.closeTooEarly", {
        date: formatLongDate(observeOn, locale),
      }),
    };
  }

  try {
    const result = await previewMonthClose(
      db,
      userId,
      parsed.data.year,
      parsed.data.month,
      parsed.data.closingBalance,
    );

    const { error } = await db.from("month_closes").upsert(
      {
        user_id: userId,
        month: monthColumnValue(parsed.data.year, parsed.data.month),
        closing_balance: parsed.data.closingBalance,
        observed_on: observeOn,
        // A figure typed by hand, over a bank close or not: it says nothing
        // of which accounts it holds.
        balance_source: "manual",
        bank_accounts: null,
        opening_balance: null,
      },
      { onConflict: "user_id,month" },
    );

    return error
      ? { error: dbError(error) }
      : {
          success: true,
          result,
          run: await runAfterClose(
            db,
            userId,
            monthColumnValue(parsed.data.year, parsed.data.month),
            locale,
          ),
        };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "monthClose.couldNotClose",
    };
  }
}

/**
 * What the close just recorded did to the run, for the sheet to say:
 * the history replayed with and without this month. A failure here costs the
 * moment, never the close.
 */
async function runAfterClose(
  db: Db,
  userId: string,
  monthColumn: string,
  locale: Locale,
): Promise<RunMoment | null> {
  try {
    const overview = await getMonthCloseOverview(
      db,
      userId,
      todayIsoLocal(),
      locale,
    );
    const key = monthKeyOfClose(monthColumn);
    const before = summarizeCloseHistory(
      overview.history.filter((row) => row.monthKey !== key),
      overview.settings.unrecordedCap,
    );
    return runMoment(before, overview.summary);
  } catch {
    return null;
  }
}

/** Undo a mistyped balance. The months after it simply re-link. */
export async function deleteMonthClose(
  db: Db,
  userId: string,
  year: number,
  month: number,
): Promise<ActionResult> {
  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance: 0 });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db
    .from("month_closes")
    .delete()
    .eq("user_id", userId)
    .eq("month", monthColumnValue(parsed.data.year, parsed.data.month));

  return error
    ? { error: dbError(error) }
    : { success: true, message: "actions.closeRemoved" };
}

/** Set or remove the allowance a month's unrecorded spending is held to. */
export async function updateUnrecordedCap(
  db: Db,
  userId: string,
  cap: number | null,
): Promise<ActionResult> {
  const parsed = unrecordedCapSchema.safeParse({ cap });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { error } = await db.from("month_close_settings").upsert(
    {
      user_id: userId,
      unrecorded_cap: parsed.data.cap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: dbError(error) };
  }
  return {
    success: true,
    message: parsed.data.cap === null ? "plan.capRemoved" : "actions.capSet",
  };
}

/** The day of the following month a closing balance is read on. */
export async function updateCloseDay(
  db: Db,
  userId: string,
  closeDay: number,
): Promise<ActionResult> {
  const parsed = closeDaySchema.safeParse({ closeDay });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { error } = await db.from("month_close_settings").upsert(
    {
      user_id: userId,
      close_day: parsed.data.closeDay,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return error
    ? { error: dbError(error) }
    : { success: true, message: "actions.readingDayUpdated" };
}
