"use server";

import { z } from "zod";
import { getLocale } from "@/lib/locale";

import { revalidateApp } from "@/lib/revalidate-paths";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/supabase/env";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
import {
  getCurrentMonth,
  getMonthBounds,
  shiftIsoDate,
  todayIsoLocal,
} from "@finance/core/constants";
import { resolveRecurringAmount } from "@finance/core/recurring-shares";
import { quoteSource } from "@finance/data/quote-source";
import {
  recurringOccurrenceKey,
  scheduleDatesBefore,
} from "@finance/core/apply-recurring";
import {
  fillDue,
  fillMonth,
  followTemplate,
  removeTemplateForecasts,
  skipOccurrences,
  skipWhatTemplatesWrote,
} from "@finance/data/recurring-apply";
import { hasBankFeed } from "@/lib/queries/bank";
import {
  removeInvestmentPositionForRecurring,
  syncInvestmentPositionFromRecurring,
} from "@/lib/investment-recurring-sync";
import {
  BITCOIN_INSTRUMENT,
  isCryptoCategoryName,
} from "@finance/core/crypto-holdings";
import type { Database } from "@finance/core/types/database";
import {
  authSchema,
  deleteTransactionsSchema,
  moveTransactionsSchema,
  importTransactionsSchema,
  parseUuid,
  recurringTemplateSchema,
  transactionSchema,
  updateTransactionSchema,
} from "@finance/core/validations/finance";
import { cashDateOf, movedBetween } from "@finance/core/cash-date";

type ActionResult = { error?: string; success?: boolean; message?: string };

async function getUser() {
  const user = await getAuthUser();

  if (!user) {
    return null;
  }

  return user;
}

/** The first day of the month in progress. */
function firstOfCurrentMonth(): string {
  const { year, month } = getCurrentMonth();
  return getMonthBounds(year, month).start;
}

type RecurringTemplateInsert =
  Database["public"]["Tables"]["recurring_templates"]["Insert"];
type RecurringTemplateUpdate =
  Database["public"]["Tables"]["recurring_templates"]["Update"];

export async function signUp(
  _prev: ActionResult,
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
  _prev: ActionResult,
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
): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = transactionSchema.safeParse({
    categoryId: input.categoryId,
    amount: input.amount,
    occurredOn: input.occurredOn,
    note: input.note?.trim() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    category_id: parsed.data.categoryId,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    note: parsed.data.note ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateApp();
  return {};
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
): Promise<{ error?: string; imported?: number }> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = importTransactionsSchema.safeParse({ rows });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const supabase = await createClient();

  // Every row must belong to one of the user's own categories; RLS covers the
  // insert, but checking here turns a database error into a clear message.
  const categoryIds = [
    ...new Set(parsed.data.rows.map((row) => row.categoryId)),
  ];
  const { data: owned, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", user.id)
    .in("id", categoryIds);

  if (categoryError) {
    return { error: categoryError.message };
  }

  if ((owned?.length ?? 0) !== categoryIds.length) {
    return { error: "actions.oneCategoryMissing" };
  }

  const { error } = await supabase.from("transactions").insert(
    parsed.data.rows.map((row) => ({
      user_id: user.id,
      category_id: row.categoryId,
      amount: row.amount,
      occurred_on: row.occurredOn,
      note: row.note?.trim() || null,
    })),
  );

  if (error) {
    return { error: error.message };
  }

  revalidateApp();
  return { imported: parsed.data.rows.length };
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
): Promise<{ error?: string; deleted?: number }> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = deleteTransactionsSchema.safeParse({ ids });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const supabase = await createClient();
  const skipError = await skipWhatTemplatesWrote(
    supabase,
    user.id,
    parsed.data.ids,
  );
  if (skipError) {
    return { error: skipError };
  }

  const { error, count } = await supabase
    .from("transactions")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .in("id", parsed.data.ids);

  if (error) {
    return { error: error.message };
  }

  revalidateApp();
  return { deleted: count ?? parsed.data.ids.length };
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
): Promise<{ error?: string; moved?: number }> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = moveTransactionsSchema.safeParse({ ids, categoryId });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const supabase = await createClient();

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (categoryError) {
    return { error: categoryError.message };
  }
  if (!category) {
    return { error: "actions.categoryMissing" };
  }

  const { error, count } = await supabase
    .from("transactions")
    .update({ category_id: parsed.data.categoryId }, { count: "exact" })
    .eq("user_id", user.id)
    .in("id", parsed.data.ids);

  if (error) {
    return { error: error.message };
  }

  revalidateApp();
  return { moved: count ?? parsed.data.ids.length };
}

export async function updateTransaction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = updateTransactionSchema.safeParse({
    id: formData.get("id"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    occurredOn: formData.get("occurredOn"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const supabase = await createClient();

  // A row a template wrote, moved to another day, leaves the day it came
  // from unwritten — and the month fills itself, so that day would be written
  // again. Skipping it is what makes the move stick.
  const { data: before } = await supabase
    .from("transactions")
    .select("recurring_template_id, occurred_on")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    before?.recurring_template_id &&
    before.occurred_on !== parsed.data.occurredOn
  ) {
    const skipError = await skipOccurrences(supabase, user.id, [
      {
        templateId: before.recurring_template_id,
        occurredOn: before.occurred_on,
      },
    ]);
    if (skipError) {
      return { error: skipError };
    }
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      category_id: parsed.data.categoryId,
      amount: parsed.data.amount,
      occurred_on: parsed.data.occurredOn,
      note: parsed.data.note ?? null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateApp();
  return { success: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  if (!parseUuid(id)) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const skipError = await skipWhatTemplatesWrote(supabase, user.id, [id]);
  if (skipError) {
    return { error: skipError };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateApp();
  return { success: true };
}

export async function upsertRecurringTemplate(
  _prev: ActionResult,
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

  const data = parsed.data;
  let amount = data.amount ?? 0;
  let pricingPayload: Pick<
    RecurringTemplateInsert,
    | "pricing_type"
    | "share_count"
    | "instrument_symbol"
    | "instrument_name"
    | "last_quote_price"
    | "last_quote_at"
  >;

  if (data.pricingType === "shares") {
    try {
      const resolved = await resolveRecurringAmount(
        {
          pricing_type: "shares",
          amount: 0,
          share_count: data.shareCount ?? null,
          instrument_symbol: data.instrumentSymbol ?? null,
          instrument_name: data.instrumentName ?? null,
          description: data.description ?? null,
          last_quote_price: null,
        },
        quoteSource,
      );
      amount = resolved.amount;
      pricingPayload = {
        pricing_type: "shares",
        share_count: data.shareCount ?? null,
        instrument_symbol: data.instrumentSymbol ?? null,
        instrument_name: data.instrumentName ?? null,
        last_quote_price: resolved.quoteUpdate?.last_quote_price ?? null,
        last_quote_at: resolved.quoteUpdate?.last_quote_at ?? null,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "actions.couldNotPrice",
      };
    }
  } else {
    pricingPayload = {
      pricing_type: "fixed",
      share_count: null,
      instrument_symbol: data.instrumentSymbol?.trim() || null,
      instrument_name: data.instrumentName?.trim() || null,
      last_quote_price: null,
      last_quote_at: null,
    };
  }

  const supabase = await createClient();
  const { data: categoryRow } = await supabase
    .from("categories")
    .select("name")
    .eq("id", data.categoryId)
    .single();

  if (
    categoryRow &&
    isCryptoCategoryName(categoryRow.name) &&
    data.pricingType === "fixed"
  ) {
    pricingPayload.instrument_symbol = BITCOIN_INSTRUMENT.symbol;
    pricingPayload.instrument_name = BITCOIN_INSTRUMENT.name;
  }

  const base = {
    category_id: data.categoryId,
    amount,
    active: data.active ?? true,
    description: data.description?.trim() || null,
    starts_on: data.startsOn ?? null,
    ends_on: data.endsOn ?? null,
    ...pricingPayload,
  };

  function buildSchedulePayload():
    | Pick<
        RecurringTemplateInsert,
        "recurrence" | "day_of_month" | "day_of_week" | "month_of_year"
      >
    | Pick<
        RecurringTemplateUpdate,
        "recurrence" | "day_of_month" | "day_of_week" | "month_of_year"
      > {
    if (data.recurrence === "monthly") {
      return {
        recurrence: "monthly",
        day_of_month: data.dayOfMonth,
        day_of_week: null,
        month_of_year: null,
      };
    }

    if (data.recurrence === "weekly") {
      return {
        recurrence: "weekly",
        day_of_month: null,
        day_of_week: data.dayOfWeek,
        month_of_year: null,
      };
    }

    return {
      recurrence: "yearly",
      month_of_year: data.monthOfYear,
      day_of_month: data.dayOfMonth,
      day_of_week: null,
    };
  }

  let templateId = data.id;
  const schedule = buildSchedulePayload();

  // What the template said before this save, so the rows it already wrote
  // can tell whether they have been moved to another day or stopped.
  const { data: previous } = data.id
    ? await supabase
        .from("recurring_templates")
        .select(
          "recurrence, day_of_month, day_of_week, month_of_year, starts_on, ends_on, active",
        )
        .eq("id", data.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  if (data.id) {
    const updatePayload: RecurringTemplateUpdate = {
      ...base,
      ...schedule,
    };

    const { error } = await supabase
      .from("recurring_templates")
      .update(updatePayload)
      .eq("id", data.id)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }
  } else {
    const insertPayload: RecurringTemplateInsert = {
      user_id: user.id,
      ...base,
      ...schedule,
    };

    const { data: inserted, error } = await supabase
      .from("recurring_templates")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error || !inserted) {
      return { error: error?.message ?? "actions.couldNotSaveRecurring" };
    }

    templateId = inserted.id;
  }

  if (templateId) {
    await syncInvestmentPositionFromRecurring(supabase, user.id, templateId);
  }

  // The ledger follows the template straight away rather than on the next
  // visit. A failure here does not undo a save that worked: the month fills
  // itself again the next time the app opens.
  if (templateId && !(await hasBankFeed(user.id))) {
    const today = todayIsoLocal();
    try {
      if (previous === null) {
        // New. It starts from the next date to come — `isDue` sees to that —
        // unless the user said this month's had already happened.
        if (formData.get("startThisMonth") === "true") {
          const { year, month } = getCurrentMonth();
          await fillMonth(
            supabase,
            user.id,
            year,
            month,
            today,
            new Set(
              scheduleDatesBefore(
                {
                  recurrence: data.recurrence,
                  day_of_month: schedule.day_of_month ?? null,
                  day_of_week: schedule.day_of_week ?? null,
                  month_of_year: schedule.month_of_year ?? null,
                  starts_on: base.starts_on,
                  ends_on: base.ends_on,
                },
                year,
                month,
                today,
              ).map((date) => recurringOccurrenceKey(templateId!, date)),
            ),
          );
        }
      } else {
        const reschedule =
          previous.recurrence !== schedule.recurrence ||
          previous.day_of_month !== (schedule.day_of_month ?? null) ||
          previous.day_of_week !== (schedule.day_of_week ?? null) ||
          previous.month_of_year !== (schedule.month_of_year ?? null) ||
          previous.starts_on !== base.starts_on ||
          previous.ends_on !== base.ends_on ||
          previous.active !== base.active;

        // "Apply this change to": this month too reaches back to its first
        // day, upcoming only starts tomorrow. Nothing reaches a past month.
        await followTemplate(supabase, user.id, templateId, {
          today,
          from:
            formData.get("applyToThisMonth") === "true"
              ? firstOfCurrentMonth()
              : shiftIsoDate(today, 1),
          reschedule,
        });
      }
    } catch {
      // See above.
    }
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
