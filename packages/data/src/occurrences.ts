import type { ActionResult } from "@finance/core/action-result";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import { isPurchaseInsideWallet } from "@finance/core/categories";
import { shiftIsoDate, todayIsoLocal } from "@finance/core/constants";
import { purchasesToConfirm } from "@finance/core/purchases-to-confirm";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { occurrenceSchema, parseUuid } from "@finance/core/validations/finance";

import { hasBankFeed } from "./bank-feed";
import type { Db } from "./client";
import {
  fillDue,
  fillMonth,
  followTemplate,
  removeTemplateForecasts,
  skipOccurrences,
} from "./recurring-apply";
import { removeInvestmentPositionForRecurring } from "./recurring-positions";
import { dbError } from "./errors";

/**
 * What can be done to a recurring template and to one of its occurrences,
 * for both apps: delete or pause a template, fill the month, and record,
 * skip or restore one occurrence.
 *
 * With a bank feeding the ledger, templates only forecast: none of these
 * writes a row the template would have written, because the bank already
 * says what happened.
 */

/** Delete a template, after the rows it wrote ahead of today and its position. */
export async function deleteRecurringTemplate(
  db: Db,
  userId: string,
  id: string,
): Promise<ActionResult> {
  if (!parseUuid(id)) {
    return { error: "errors.invalidInput" };
  }

  // Before the template goes, while its rows still say where they came from.
  if (!(await hasBankFeed(db, userId))) {
    const removeError = await removeTemplateForecasts(
      db,
      userId,
      id,
      todayIsoLocal(),
    );
    if (removeError) {
      return { error: removeError };
    }
  }

  await removeInvestmentPositionForRecurring(db, userId, id);

  const { error } = await db
    .from("recurring_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return error ? { error: dbError(error) } : { success: true };
}

/**
 * Switch a template on or off.
 *
 * Either way it starts again, or stops, from tomorrow: switched on, the days
 * it missed while off are not written after the fact; switched off, its rows
 * written ahead go with it. What it recorded before stays.
 */
export async function toggleRecurringActive(
  db: Db,
  userId: string,
  id: string,
  active: boolean,
): Promise<ActionResult> {
  if (!parseUuid(id)) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db
    .from("recurring_templates")
    .update({ active })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: dbError(error) };
  }

  if (!(await hasBankFeed(db, userId))) {
    const today = todayIsoLocal();
    try {
      await followTemplate(db, userId, id, {
        today,
        from: shiftIsoDate(today, 1),
        reschedule: true,
      });
    } catch {
      // The switch itself worked, and the next open fills the month.
    }
  }

  return { success: true };
}

/**
 * Write the charges whose day has come.
 *
 * There is no button for this any more: both apps call it when they open and
 * again when they come back on another day, so the charges the user set up
 * are simply there on their day. Most calls find nothing to write and cost a
 * few small reads.
 */
export async function fillThisMonth(
  db: Db,
  userId: string,
): Promise<{ created: number; error?: string }> {
  if (await hasBankFeed(db, userId)) {
    return { created: 0 };
  }

  try {
    const { created, failures } = await fillDue(db, userId, todayIsoLocal());
    return failures.length > 0 ? { created, error: failures[0] } : { created };
  } catch (error) {
    return {
      created: 0,
      error:
        error instanceof Error ? error.message : "actions.couldNotFillMonth",
    };
  }
}

/**
 * A planned occurrence that has already happened, recorded today.
 *
 * The salary due on the 28th that arrived on the 27th: written now, dated
 * today, at the charge's amount — the row can be corrected like any other —
 * and the planned day is skipped, so the day it was due does not write it a
 * second time.
 */
export async function recordPlannedNow(
  db: Db,
  userId: string,
  templateId: string,
  occurredOn: string,
): Promise<ActionResult<{ transactionId: string }>> {
  const parsed = occurrenceSchema.safeParse({ templateId, occurredOn });
  const today = todayIsoLocal();
  if (!parsed.success || parsed.data.occurredOn <= today) {
    return { error: "errors.invalidInput" };
  }

  const { data: template } = await db
    .from("recurring_templates")
    .select("id, category_id, amount, description")
    .eq("id", parsed.data.templateId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!template) {
    return { error: "actions.recurringNotFound" };
  }

  const skipError = await skipOccurrences(db, userId, [
    { templateId: template.id, occurredOn: parsed.data.occurredOn },
  ]);
  if (skipError) {
    return { error: skipError };
  }

  const { data: inserted, error } = await db
    .from("transactions")
    .insert({
      user_id: userId,
      category_id: template.category_id,
      recurring_template_id: template.id,
      occurred_on: today,
      amount: Number(template.amount),
      note: template.description?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error ? dbError(error) : "actions.couldNotRecord" };
  }

  return { success: true, transactionId: inserted.id };
}

/**
 * A purchase inside a wallet the user says went through, recorded on its own
 * day — the yes to `purchasesToConfirm`.
 *
 * With a bank feeding the ledger nothing writes it otherwise: the bank never
 * sees the money move inside the broker. Written by the fill, exactly as it
 * would have been on its day without a bank, so it is priced and linked to
 * its template like any other and grows the position it feeds. Asked twice,
 * the unique index on (template, date) keeps it to one row.
 *
 * `boughtOn`, one of the purchase's `laterDays`, is the day it went through
 * instead: the broker turned it down for want of cash, the user sent more
 * and bought by hand. The row is written as above and then moved there,
 * which records the skip that moving any template's row does, so its own day
 * is neither asked about nor written again.
 */
export async function recordPurchaseInsideWallet(
  db: Db,
  userId: string,
  templateId: string,
  occurredOn: string,
  boughtOn?: string,
): Promise<ActionResult> {
  const parsed = occurrenceSchema.safeParse({ templateId, occurredOn });
  const today = todayIsoLocal();
  if (!parsed.success || parsed.data.occurredOn > today) {
    return { error: "errors.invalidInput" };
  }

  const { data: template } = await db
    .from("recurring_templates")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("id", parsed.data.templateId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!template?.categories || !isPurchaseInsideWallet(template.categories)) {
    return { error: "actions.recurringNotFound" };
  }

  const later = boughtOn !== undefined && boughtOn !== parsed.data.occurredOn;
  if (later) {
    const offered = purchasesToConfirm({
      templates: [template as RecurringTemplateWithCategory],
      writtenKeys: new Set(),
      settledKeys: new Set(),
      today,
    }).find((purchase) => purchase.occurredOn === parsed.data.occurredOn);
    if (!offered?.laterDays.includes(boughtOn)) {
      return { error: "errors.invalidInput" };
    }
  }

  const [year, month] = parsed.data.occurredOn.split("-").map(Number);
  const { failures } = await fillMonth(
    db,
    userId,
    year!,
    month!,
    today,
    new Set([recurringOccurrenceKey(template.id, parsed.data.occurredOn)]),
  );
  if (failures.length > 0) {
    return { error: failures[0]! };
  }

  if (later) {
    const skipError = await skipOccurrences(db, userId, [
      { templateId: template.id, occurredOn: parsed.data.occurredOn },
    ]);
    if (skipError) {
      return { error: skipError };
    }
    const { error } = await db
      .from("transactions")
      .update({ occurred_on: boughtOn })
      .eq("user_id", userId)
      .eq("recurring_template_id", template.id)
      .eq("occurred_on", parsed.data.occurredOn);
    if (error) {
      return { error: dbError(error) };
    }
  }

  return { success: true, message: "actions.purchaseRecorded" };
}

/**
 * Take back "record it now": the row goes and the planned day returns.
 *
 * Recording it now skipped its planned day, so that day would not be written
 * a second time; without taking the skip away the occurrence would not come
 * back as planned. A failure there is reported, not swallowed — the row is
 * already gone by then, so the caller should redraw either way.
 */
export async function undoRecordPlanned(
  db: Db,
  userId: string,
  transactionId: string,
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const parsed = occurrenceSchema.safeParse({ templateId, occurredOn });
  if (!parsed.success || !parseUuid(transactionId)) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userId)
    .eq("recurring_template_id", parsed.data.templateId);

  if (error) {
    return { error: dbError(error) };
  }

  const { error: skipError } = await db
    .from("recurring_skips")
    .delete()
    .eq("user_id", userId)
    .eq("template_id", parsed.data.templateId)
    .eq("occurred_on", parsed.data.occurredOn);

  return skipError ? { error: dbError(skipError) } : { success: true };
}

/**
 * Take one planned occurrence out of its month. Nothing is stored for a
 * planned row, so this is only the skip; `unskipRecurringOccurrence` puts it
 * back.
 */
export async function skipPlannedOccurrence(
  db: Db,
  userId: string,
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const parsed = occurrenceSchema.safeParse({ templateId, occurredOn });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const { data: template } = await db
    .from("recurring_templates")
    .select("id")
    .eq("id", parsed.data.templateId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!template) {
    return { error: "actions.recurringNotFound" };
  }

  const skipError = await skipOccurrences(db, userId, [
    { templateId: template.id, occurredOn: parsed.data.occurredOn },
  ]);
  return skipError ? { error: skipError } : { success: true };
}

/**
 * Lift a skip and write the occurrence straight back — and only this one:
 * restoring an occurrence in a past month is not a reason to fill the rest
 * of that month. Without this, skipping was a one-way door.
 */
export async function unskipRecurringOccurrence(
  db: Db,
  userId: string,
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const parsed = occurrenceSchema.safeParse({ templateId, occurredOn });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db
    .from("recurring_skips")
    .delete()
    .eq("user_id", userId)
    .eq("template_id", parsed.data.templateId)
    .eq("occurred_on", parsed.data.occurredOn);

  if (error) {
    return { error: dbError(error) };
  }

  if (!(await hasBankFeed(db, userId))) {
    const [year, month] = parsed.data.occurredOn.split("-").map(Number);
    await fillMonth(
      db,
      userId,
      year!,
      month!,
      todayIsoLocal(),
      new Set([
        recurringOccurrenceKey(parsed.data.templateId, parsed.data.occurredOn),
      ]),
    );
  }

  return { success: true, message: "actions.skipRemoved" };
}
