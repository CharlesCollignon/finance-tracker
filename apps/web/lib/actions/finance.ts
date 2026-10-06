"use server";

import { z } from "zod";
import { getLocale } from "@/lib/locale";

import { revalidateApp } from "@/lib/revalidate-paths";
import * as dcaInvite from "@finance/data/dca-invite";
import * as deletions from "@finance/data/deletions";
import * as ledger from "@finance/data/ledger";
import * as occurrences from "@finance/data/occurrences";
import type { ActionResult, FormState } from "@finance/core/action-result";
import { signInErrorKey, signUpErrorKey } from "@finance/core/auth-errors";
import { asUser } from "@/lib/actions/as-user";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/supabase/env";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { shiftIsoDate, todayIsoLocal } from "@finance/core/constants";
import { saveRecurringTemplate } from "@finance/data/recurring-templates";
import {
  authSchema,
  recurringTemplateSchema,
} from "@finance/core/validations/finance";
import { cashDateOf, movedBetween } from "@finance/core/cash-date";
import { dbError } from "@finance/data/errors";

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
    return { error: signUpErrorKey(error.code) };
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
    return { error: signInErrorKey(error.code) };
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
    return { error: dbError(error) };
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
): Promise<ActionResult<{ deleted: number; undo: deletions.UndoToken }>> {
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

export async function deleteTransaction(
  id: string,
): Promise<ActionResult<{ undo: deletions.UndoToken }>> {
  return asUser((db, userId) => ledger.deleteTransaction(db, userId, id));
}

/** Take back one delete — transactions or a category — by its token. */
export async function restoreDeletion(
  token: string,
): Promise<ActionResult<{ restored: number }>> {
  return asUser((db, userId) => deletions.restoreDeletion(db, userId, token));
}

/** Yes to « Faire suivre vos DCA »: see `acceptTransferInvitation`. */
export async function acceptDcaTransferInvite(): Promise<ActionResult> {
  const locale = await getLocale();
  return asUser((db, userId) =>
    dcaInvite.acceptTransferInvitation(db, userId, todayIsoLocal(), locale),
  );
}

/** No thanks to « Faire suivre vos DCA », on every device. */
export async function dismissDcaTransferInvite(): Promise<ActionResult> {
  const locale = await getLocale();
  return asUser((db, userId) =>
    dcaInvite.dismissTransferInvitation(db, userId, locale),
  );
}

/** The form's pricing, read defensively: anything unknown is a fixed amount. */
function pricingTypeOf(value: FormDataEntryValue | null) {
  return value === "shares" || value === "purchases" ? value : "fixed";
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
    pricingType: pricingTypeOf(formData.get("pricingType")),
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
    propertyId: formData.has("propertyId")
      ? String(formData.get("propertyId"))
      : undefined,
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
  return asUser((db, userId) =>
    occurrences.deleteRecurringTemplate(db, userId, id),
  );
}

export async function toggleRecurringActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    occurrences.toggleRecurringActive(db, userId, id, active),
  );
}

/**
 * Write the charges whose day has come — see `fillThisMonth` in
 * `@finance/data/occurrences`. Every surface is revalidated only when
 * something was written: the new rows move figures on all of them.
 */
export async function fillThisMonth(): Promise<{
  created: number;
  error?: string;
}> {
  const user = await getUser();
  if (!user) {
    return { created: 0 };
  }

  const result = await occurrences.fillThisMonth(await createClient(), user.id);
  if (result.created > 0) {
    revalidateApp();
  }
  return result;
}

export async function recordPlannedNow(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult<{ transactionId: string }>> {
  return asUser((db, userId) =>
    occurrences.recordPlannedNow(db, userId, templateId, occurredOn),
  );
}

/**
 * Take back "record it now". Redrawn whatever came of it: if only the skip
 * failed to go, the row is gone all the same and the page should say so.
 */
export async function undoRecordPlanned(
  transactionId: string,
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const result = await occurrences.undoRecordPlanned(
    await createClient(),
    user.id,
    transactionId,
    templateId,
    occurredOn,
  );
  revalidateApp();
  return result;
}

export async function skipPlannedOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    occurrences.skipPlannedOccurrence(db, userId, templateId, occurredOn),
  );
}

export async function unskipRecurringOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    occurrences.unskipRecurringOccurrence(db, userId, templateId, occurredOn),
  );
}

export async function recordPurchaseInsideWallet(
  templateId: string,
  occurredOn: string,
  boughtOn?: string,
): Promise<ActionResult> {
  return asUser((db, userId) =>
    occurrences.recordPurchaseInsideWallet(
      db,
      userId,
      templateId,
      occurredOn,
      boughtOn,
    ),
  );
}
