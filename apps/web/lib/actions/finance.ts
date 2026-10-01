"use server";

import { z } from "zod";
import { getLocale } from "@/lib/locale";

import { revalidateApp } from "@/lib/revalidate-paths";
import * as ledger from "@finance/data/ledger";
import type { ActionResult, FormState } from "@finance/core/action-result";
import { asUser } from "@/lib/actions/as-user";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/supabase/env";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { shiftIsoDate, todayIsoLocal } from "@finance/core/constants";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import {
  fillDue,
  fillMonth,
  followTemplate,
  removeTemplateForecasts,
  skipOccurrences,
} from "@finance/data/recurring-apply";
import { hasBankFeed } from "@/lib/queries/bank";
import { removeInvestmentPositionForRecurring } from "@finance/data/recurring-positions";
import { saveRecurringTemplate } from "@finance/data/recurring-templates";
import {
  authSchema,
  parseUuid,
  recurringTemplateSchema,
} from "@finance/core/validations/finance";
import { cashDateOf, movedBetween } from "@finance/core/cash-date";

async function getUser() {
  const user = await getAuthUser();

  if (!user) {
    return null;
  }

  return user;
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user && !data.session) {
    return {
      success: true,
      message: "auth.confirmEmail",
    };
  }

  if (data.user) {
    await seedCategoriesSafely(data.user.id);
  }

  return { success: true };
}

async function seedCategoriesSafely(userId: string): Promise<void> {
  try {
    await seedDefaultCategories(userId, await getLocale());
  } catch (error) {
    // Seeding must never block auth; missing defaults can be re-seeded
    // on the next sign-in.
    console.error("Failed to seed default categories", error);
  }
}

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await seedCategoriesSafely(data.user.id);
  }

  return { success: true };
}

export async function seedCategoriesForCurrentUser(): Promise<void> {
  const user = await getAuthUser();
  if (!user) {
    return;
  }
  await seedCategoriesSafely(user.id);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export interface QuickTransactionInput {
  categoryId: string;
  amount: string | number;
  occurredOn: string;
  note?: string;
}

/**
 * Save from the quick-add sheet.
 *
 * Takes an object rather than a FormData because the sheet stays open across
 * saves ("save and add another") and never navigates, so there is no form
 * submission to piggyback on.
 */
export async function saveQuickTransaction(
  input: QuickTransactionInput,
): Promise<ActionResult> {
  return asUser((db, userId) => ledger.createTransaction(db, userId, input));
}

/**
 * Commit a reviewed CSV import.
 *
 * The rows arriving here have already been parsed, de-duplicated and
 * categorised in the review step — this only re-validates and writes, so a
 * tampered payload cannot bypass the schema.
 */
export async function importTransactions(
  rows: {
    categoryId: string;
    amount: number;
    occurredOn: string;
    note?: string;
  }[],
): Promise<ActionResult<{ imported: number }>> {
  return asUser((db, userId) => ledger.importTransactions(db, userId, rows));
}

/**
 * The ledger rows that overlap an import's date range.
 *
 * Only the three fields the duplicate check needs are returned, so importing a
 * long statement does not drag the user's whole history to the browser.
 */
export async function getExistingKeysForRange(
  from: string,
  to: string,
): Promise<{
  error?: string;
  keys?: { occurredOn: string; amount: number; note: string | null }[];
}> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const range = z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse({ from, to });

  if (!range.success) {
    return { error: "actions.invalidDateRange" };
  }

  // A statement dates each line by the day its money moved, so the check
  // does too (`cashDateOf`). An income counted for next month sits up to a
  // month after that day, hence the wider read before the filter below.
  // `*` rather than naming `cash_on`, which does not exist before 045.
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .gte("occurred_on", range.data.from)
    .lte("occurred_on", shiftIsoDate(range.data.to, 31));
  const data = (rows ?? [])
    .filter((row) => movedBetween(row, range.data.from, range.data.to))
    .map((row) => ({ ...row, occurred_on: cashDateOf(row) }));

  if (error) {
    return { error: error.message };
  }

  return {
    keys: (data ?? []).map((row) => ({
      occurredOn: row.occurred_on,
      amount: Number(row.amount),
      note: row.note,
    })),
  };
}

/**
 * Deletes several transactions at once.
 *
 * The row-level policy already scopes deletes to the caller, and the explicit
 * user_id filter keeps it that way if the policy is ever loosened.
 */
export async function deleteTransactions(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  return asUser((db, userId) => ledger.deleteTransactions(db, userId, ids));
}

/**
 * Moves several transactions into another category.
 *
 * The counterpart to the delete above, with one check it does not need: the
 * target category is a caller-supplied foreign key, and the row-level policy
 * on `transactions` polices which rows may be written, not what they may
 * point at. So the category is confirmed to belong to this user first, rather
 * than trusting an id that arrived from a browser.
 *
 * Nothing here touches `bank_feed_items`: a feed row carries no category of
 * its own, only a `transaction_id`, so moving the transaction is the whole
 * change. And nothing here rewrites merchant memory, because there is no
 * merchant memory to rewrite — it is derived from the transactions on every
 * bank sync, which is what makes this correction stick.
 */
export async function moveTransactions(
  ids: string[],
  categoryId: string,
): Promise<ActionResult<{ moved: number }>> {
  return asUser((db, userId) =>
    ledger.moveTransactions(db, userId, ids, categoryId),
  );
}

export async function updateTransaction(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    ledger.updateTransaction(db, userId, {
      id: String(formData.get("id") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      occurredOn: String(formData.get("occurredOn") ?? ""),
      note: (formData.get("note") as string | null) || undefined,
    }),
  );
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  return asUser((db, userId) => ledger.deleteTransaction(db, userId, id));
}

export async function upsertRecurringTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = recurringTemplateSchema.safeParse({
    id: formData.get("id") || undefined,
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount") || undefined,
    pricingType: formData.get("pricingType") === "shares" ? "shares" : "fixed",
    shareCount: formData.get("shareCount") || undefined,
    instrumentSymbol: formData.get("instrumentSymbol") || undefined,
    instrumentName: formData.get("instrumentName") || undefined,
    description: formData.get("description") || undefined,
    recurrence: formData.get("recurrence"),
    dayOfMonth: formData.get("dayOfMonth") || undefined,
    dayOfWeek: formData.get("dayOfWeek") || undefined,
    monthOfYear: formData.get("monthOfYear") || undefined,
    startsOn: formData.get("startsOn") || undefined,
    endsOn: formData.get("endsOn") || undefined,
    active: formData.get("active") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const saved = await saveRecurringTemplate(
    await createClient(),
    user.id,
    parsed.data,
    {
      startThisMonth: formData.get("startThisMonth") === "true",
      applyToThisMonth: formData.get("applyToThisMonth") === "true",
    },
  );
  if ("error" in saved) {
    return { error: saved.error };
  }

  revalidateApp();
  return { success: true };
}

export async function deleteRecurringTemplate(
  id: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  if (!parseUuid(id)) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();

  // Before the template goes, while its rows still say where they came from.
  if (!(await hasBankFeed(user.id))) {
    const removeError = await removeTemplateForecasts(
      supabase,
      user.id,
      id,
      todayIsoLocal(),
    );
    if (removeError) {
      return { error: removeError };
    }
  }

  await removeInvestmentPositionForRecurring(supabase, user.id, id);

  const { error } = await supabase
    .from("recurring_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateApp();
  return { success: true };
}

export async function toggleRecurringActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_templates")
    .update({ active })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Either way it starts again, or stops, from tomorrow: switched on, the
  // days it missed while off are not written after the fact; switched off,
  // its rows written ahead go with it. What it recorded before stays.
  if (!(await hasBankFeed(user.id))) {
    const today = todayIsoLocal();
    try {
      await followTemplate(supabase, user.id, id, {
        today,
        from: shiftIsoDate(today, 1),
        reschedule: true,
      });
    } catch {
      // The switch itself worked, and the next visit fills the month.
    }
  }

  revalidateApp();
  return { success: true };
}

/**
 * Write the charges whose day has come.
 *
 * There is no button for this any more. The app calls it once when it opens,
 * and again when a tab left open comes back into view on another day, so the
 * charges the user set up are simply there on their day — and the days ahead
 * show them as planned until then. Most calls find nothing to write and cost
 * a few small reads.
 *
 * When something was written, every surface is revalidated: the new rows
 * move figures on all of them, and the page on screen redraws with them in
 * the same response.
 */
export async function fillThisMonth(): Promise<{
  created: number;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { created: 0 };
  }

  // With a bank feeding the ledger, templates do not write: the account is
  // the record of what happened and a template only says what is coming.
  if (await hasBankFeed(user.id)) {
    return { created: 0 };
  }

  try {
    const supabase = await createClient();
    const { created, failures } = await fillDue(
      supabase,
      user.id,
      todayIsoLocal(),
    );

    if (created > 0) {
      revalidateApp();
    }

    return failures.length > 0 ? { created, error: failures[0] } : { created };
  } catch (error) {
    return {
      created: 0,
      error:
        error instanceof Error ? error.message : "actions.couldNotFillMonth",
    };
  }
}

const occurrenceInput = z.object({
  templateId: z.string().uuid(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * A planned occurrence that has already happened, recorded today.
 *
 * The salary due on the 28th that arrived on the 27th: written now, dated
 * today, at the charge's amount — the row can be corrected like any other —
 * and the planned day is skipped, so the day it was due does not write it a
 * second time.
 */
export async function recordPlannedNow(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult & { transactionId?: string }> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = occurrenceInput.safeParse({ templateId, occurredOn });
  const today = todayIsoLocal();
  if (!parsed.success || parsed.data.occurredOn <= today) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("recurring_templates")
    .select("id, category_id, amount, description")
    .eq("id", parsed.data.templateId)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!template) {
    return { error: "actions.recurringNotFound" };
  }

  const skipError = await skipOccurrences(supabase, user.id, [
    { templateId: template.id, occurredOn: parsed.data.occurredOn },
  ]);
  if (skipError) {
    return { error: skipError };
  }

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      category_id: template.category_id,
      recurring_template_id: template.id,
      occurred_on: today,
      amount: Number(template.amount),
      note: template.description?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "actions.couldNotRecord" };
  }

  revalidateApp();
  return { success: true, transactionId: inserted.id };
}

/** Take back "record it now": the row goes and the planned day returns. */
export async function undoRecordPlanned(
  transactionId: string,
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = occurrenceInput.safeParse({ templateId, occurredOn });
  if (!parsed.success || !parseUuid(transactionId)) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .eq("recurring_template_id", parsed.data.templateId);

  if (error) {
    return { error: error.message };
  }

  // Recording it now skipped its planned day, so that day would not be
  // written a second time; without taking the skip away the occurrence would
  // not come back as planned. A failure here used to be ignored and the undo
  // reported as done, with the occurrence gone from the month.
  const { error: skipError } = await supabase
    .from("recurring_skips")
    .delete()
    .eq("user_id", user.id)
    .eq("template_id", parsed.data.templateId)
    .eq("occurred_on", parsed.data.occurredOn);

  revalidateApp();
  if (skipError) {
    return { error: skipError.message };
  }
  return { success: true };
}

/**
 * Take one planned occurrence out of its month. Nothing is stored for a
 * planned row, so this is only the skip; `unskipRecurringOccurrence` puts it
 * back.
 */
export async function skipPlannedOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = occurrenceInput.safeParse({ templateId, occurredOn });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("recurring_templates")
    .select("id")
    .eq("id", parsed.data.templateId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!template) {
    return { error: "actions.recurringNotFound" };
  }

  const skipError = await skipOccurrences(supabase, user.id, [
    { templateId: template.id, occurredOn: parsed.data.occurredOn },
  ]);
  if (skipError) {
    return { error: skipError };
  }

  revalidateApp();
  return { success: true };
}

export async function unskipRecurringOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  if (
    !/^[0-9a-f-]{36}$/i.test(templateId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)
  ) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_skips")
    .delete()
    .eq("user_id", user.id)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn);

  if (error) {
    return { error: error.message };
  }

  // Written straight back, and only this one: restoring an occurrence in a
  // past month is not a reason to fill the rest of that month.
  if (!(await hasBankFeed(user.id))) {
    const [year, month] = occurredOn.split("-").map(Number);
    await fillMonth(
      supabase,
      user.id,
      year!,
      month!,
      todayIsoLocal(),
      new Set([recurringOccurrenceKey(templateId, occurredOn)]),
    );
  }

  revalidateApp();
  return { success: true, message: "actions.skipRemoved" };
}
