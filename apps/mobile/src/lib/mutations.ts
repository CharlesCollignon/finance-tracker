import { isMissingSchema } from "@finance/data/schema";
import {
  authSchema,
  categorySchema,
  deleteTransactionsSchema,
  moveTransactionsSchema,
  importTransactionsSchema,
  recurringTemplateSchema,
  transactionSchema,
  updateTransactionSchema,
} from "@finance/core/validations/finance";
import {
  profileSchema,
  deleteConfirmSchema,
} from "@finance/core/validations/profile";
import {
  walletPlanSchema,
  walletTargetsSchema,
} from "@finance/core/validations/investments";
import { isSavingsAccountId, type AccountId } from "@finance/core/allocation";
import {
  shiftIsoDate,
  todayIsoLocal,
  formatLongDate,
  formatShortDate,
} from "@finance/core/constants";
import { cashDateOf } from "@finance/core/cash-date";
import { monthLong } from "@finance/core/i18n/calendar-names";
import { countsForMonthOf } from "@finance/core/recurring-fulfilment";
import {
  monthColumnValue,
  observationDateFor,
  type MonthCloseResult,
} from "@finance/core/month-close";
import {
  closeDaySchema,
  monthCloseSchema,
  unrecordedCapSchema,
} from "@finance/core/validations/month-close";
import {
  getMonthCloseSettings,
  hasBankFeed,
  ledgerRowsAround,
  previewMonthClose,
} from "@/lib/queries";
import { findLedgerMatch } from "@finance/core/bank-feed";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
import type {
  CategoryType,
  SavingsAccountKind,
  WalletId,
} from "@finance/core/types/database";

import { saveRecurringTemplate } from "@finance/data/recurring-templates";
import {
  fillDue,
  fillMonth,
  followTemplate,
  removeTemplateForecasts,
  skipOccurrences,
  skipWhatTemplatesWrote,
} from "@finance/data/recurring-apply";
import { supabase } from "@/lib/supabase";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";

type ActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

async function requireUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createTransaction(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    category_id: parsed.data.categoryId,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    note: parsed.data.note ?? null,
  });

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function updateTransaction(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  // A row a template wrote, moved to another day, leaves the day it came
  // from unwritten — and the month fills itself, so that day would be written
  // again. Skipping it is what makes the move stick.
  const { data: before } = await supabase
    .from("transactions")
    .select("recurring_template_id, occurred_on")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    before?.recurring_template_id &&
    before.occurred_on !== parsed.data.occurredOn
  ) {
    const skipError = await skipOccurrences(supabase, userId, [
      {
        templateId: before.recurring_template_id as string,
        occurredOn: before.occurred_on as string,
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
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  // A charge's row: deleting it takes that occurrence out of its month, so
  // the month filling itself does not write it straight back.
  const skipError = await skipWhatTemplatesWrote(supabase, userId, [id]);
  if (skipError) {
    return { error: skipError };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

/**
 * Saves a wallet position. Mirrors the web upsertInvestmentPosition query;
 * mobile edits an existing position's figures rather than creating one from
 * scratch, so name/category/template stay as they are unless supplied.
 */
export async function saveInvestmentPosition(input: {
  positionId: string;
  initialBalance: number;
  currentValue: number | null;
  shareCount: number | null;
  /** Annual ongoing charge as a fraction: 0.002 = 0.20%. */
  ongoingCharge?: number | null;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  if (!Number.isFinite(input.initialBalance) || input.initialBalance < 0) {
    return { error: "actions.invalidStartingBalance" };
  }

  const { error } = await supabase
    .from("investment_positions")
    .update({
      initial_balance: input.initialBalance,
      current_value: input.currentValue,
      share_count: input.shareCount,
      // Undefined means the caller is not editing the charge; null clears it.
      ...(input.ongoingCharge === undefined
        ? {}
        : { ongoing_charge: input.ongoingCharge }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.positionId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function removeInvestmentPosition(
  positionId: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { error } = await supabase
    .from("investment_positions")
    .delete()
    .eq("id", positionId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

/** Maps Postgres constraint failures onto something a user can act on. */
function friendlyCategoryError(message: string): string {
  if (message.includes("foreign key")) {
    return "actions.categoryInUse";
  }
  if (message.includes("duplicate key")) {
    return "actions.categoryExists";
  }
  return message;
}

export async function upsertCategory(input: {
  id?: string;
  name: string;
  type: CategoryType;
  icon?: string | null;
  countsTowardSummary?: boolean;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = categorySchema.safeParse({
    id: input.id,
    name: input.name,
    type: input.type,
    icon: input.icon ?? undefined,
    countsTowardSummary: input.countsTowardSummary ?? true,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const payload = {
    name: parsed.data.name,
    type: parsed.data.type,
    icon: parsed.data.icon ?? null,
    counts_toward_summary: parsed.data.countsTowardSummary ?? true,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("categories")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("user_id", userId)
    : await supabase.from("categories").insert({ user_id: userId, ...payload });

  if (error) {
    return { error: friendlyCategoryError(error.message) };
  }
  return { success: true };
}

export async function setCategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { error } = await supabase
    .from("categories")
    .update({ archived })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: friendlyCategoryError(error.message) };
  }
  return { success: true };
}

/**
 * Lifts a skip and writes the occurrence straight back. Without this,
 * skipping was a one-way door — the row simply vanished with no way back.
 */
export async function unskipRecurringOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  if (
    !/^[0-9a-f-]{36}$/i.test(templateId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)
  ) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await supabase
    .from("recurring_skips")
    .delete()
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn);

  if (error) {
    return { error: error.message };
  }

  // Only this one: restoring an occurrence in a past month is not a reason
  // to fill the rest of that month.
  if (!(await hasBankFeed(userId))) {
    const [year, month] = occurredOn.split("-").map(Number);
    await fillMonth(
      supabase,
      userId,
      year!,
      month!,
      todayIsoLocal(),
      new Set([recurringOccurrenceKey(templateId, occurredOn)]),
    );
  }

  return { success: true };
}

export async function upsertRecurringTemplate(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = recurringTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const saved = await saveRecurringTemplate(supabase, userId, parsed.data, {
    startThisMonth: input.startThisMonth === true,
    applyToThisMonth: input.applyToThisMonth === true,
  });
  return "error" in saved ? { error: saved.error } : { success: true };
}

export async function deleteRecurringTemplate(
  id: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  // Before the template goes, while its rows still say where they came from.
  if (!(await hasBankFeed(userId))) {
    const removeError = await removeTemplateForecasts(
      supabase,
      userId,
      id,
      todayIsoLocal(),
    );
    if (removeError) {
      return { error: removeError };
    }
  }

  await supabase
    .from("investment_positions")
    .delete()
    .eq("user_id", userId)
    .eq("recurring_template_id", id);

  const { error } = await supabase
    .from("recurring_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function toggleRecurringActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { error } = await supabase
    .from("recurring_templates")
    .update({ active })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  // Either way it starts again, or stops, from tomorrow: switched on, the
  // days it missed while off are not written after the fact; switched off,
  // its rows written ahead go with it. What it recorded before stays.
  if (!(await hasBankFeed(userId))) {
    const today = todayIsoLocal();
    try {
      await followTemplate(supabase, userId, id, {
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
 * There is no button for this any more. The app calls it when it opens and
 * again when it comes back to the foreground on another day, so the charges
 * the user set up are simply there on their day — and the days ahead show
 * them as planned until then. Most calls find nothing to write and cost a
 * few small reads.
 */
export async function fillThisMonth(): Promise<{
  created: number;
  error?: string;
}> {
  const userId = await requireUserId();
  if (!userId) {
    return { created: 0 };
  }

  // With a bank feeding the ledger, templates only forecast and never write.
  if (await hasBankFeed(userId)) {
    return { created: 0 };
  }

  try {
    const { created, failures } = await fillDue(
      supabase,
      userId,
      todayIsoLocal(),
    );
    return failures.length > 0 ? { created, error: failures[0] } : { created };
  } catch (error) {
    return {
      created: 0,
      error:
        error instanceof Error ? error.message : "actions.couldNotFillMonth",
    };
  }
}

const UUID = /^[0-9a-f-]{36}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A planned occurrence that has already happened, recorded today — the
 * salary due on the 28th that arrived on the 27th. Written now at the
 * charge's amount, and the planned day skipped so its day does not write it
 * a second time. The web twin's `recordPlannedNow`.
 */
export async function recordPlannedNow(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult & { transactionId?: string }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const today = todayIsoLocal();
  if (
    !UUID.test(templateId) ||
    !ISO_DATE.test(occurredOn) ||
    occurredOn <= today
  ) {
    return { error: "errors.invalidInput" };
  }

  const { data: template } = await supabase
    .from("recurring_templates")
    .select("id, category_id, amount, description")
    .eq("id", templateId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (!template) {
    return { error: "actions.recurringNotFound" };
  }

  const skipError = await skipOccurrences(supabase, userId, [
    { templateId: template.id as string, occurredOn },
  ]);
  if (skipError) {
    return { error: skipError };
  }

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      category_id: template.category_id as string,
      recurring_template_id: template.id as string,
      occurred_on: today,
      amount: Number(template.amount),
      note: (template.description as string | null)?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "actions.couldNotRecord" };
  }

  return { success: true, transactionId: inserted.id as string };
}

/** Take back "record it now": the row goes and the planned day returns. */
export async function undoRecordPlanned(
  transactionId: string,
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  if (
    !UUID.test(transactionId) ||
    !UUID.test(templateId) ||
    !ISO_DATE.test(occurredOn)
  ) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId);

  if (error) {
    return { error: error.message };
  }

  await supabase
    .from("recurring_skips")
    .delete()
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn);

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
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  if (!UUID.test(templateId) || !ISO_DATE.test(occurredOn)) {
    return { error: "errors.invalidInput" };
  }

  const { data: template } = await supabase
    .from("recurring_templates")
    .select("id")
    .eq("id", templateId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!template) {
    return { error: "actions.recurringNotFound" };
  }

  const skipError = await skipOccurrences(supabase, userId, [
    { templateId: template.id as string, occurredOn },
  ]);
  if (skipError) {
    return { error: skipError };
  }

  return { success: true };
}

export async function updateProfile(fullName: string): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({ fullName });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const { error } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.fullName },
  });

  if (error) {
    return { error: error.message };
  }
  return { success: true, message: "actions.profileUpdated" };
}

export async function deleteAllUserData(
  confirmation: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = deleteConfirmSchema.safeParse({ confirmation });
  if (!parsed.success) {
    return { error: "errors.deleteConfirmation" };
  }

  const { data: txs } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId);
  const txIds = (txs ?? []).map((t) => t.id);
  if (txIds.length > 0) {
    const { error } = await supabase
      .from("transaction_tags")
      .delete()
      .in("transaction_id", txIds);
    if (error) {
      return { error: error.message };
    }
  }

  for (const table of [
    "tags",
    "budgets",
    "wallet_transfers",
    "savings_goals",
    "recurring_skips",
  ] as const) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) {
      return { error: error.message };
    }
  }

  const { error: txError } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId);
  if (txError) {
    return { error: txError.message };
  }

  const { error: positionsError } = await supabase
    .from("investment_positions")
    .delete()
    .eq("user_id", userId);
  if (positionsError) {
    return { error: positionsError.message };
  }

  // Apart from the list above, because the table only exists once migration
  // 046 has run, and a missing table is nothing left to delete.
  const { error: savingsError } = await supabase
    .from("savings_accounts")
    .delete()
    .eq("user_id", userId);
  if (
    savingsError &&
    savingsError.code !== "PGRST205" &&
    savingsError.code !== "42P01"
  ) {
    return { error: savingsError.message };
  }

  const { error: recurringError } = await supabase
    .from("recurring_templates")
    .delete()
    .eq("user_id", userId);
  if (recurringError) {
    return { error: recurringError.message };
  }

  const { error: categoriesError } = await supabase
    .from("categories")
    .delete()
    .eq("user_id", userId);
  if (categoriesError) {
    return { error: categoriesError.message };
  }

  return { success: true, message: "profile.dataDeleted" };
}

/** Validate credentials shape for forms that don't go through AuthProvider. */
export function validateAuthInput(email: string, password: string) {
  return authSchema.safeParse({ email, password });
}

/**
 * Saves one wallet's plan — its target share of the portfolio, when the
 * wrapper was opened, and any non-standard contribution ceiling.
 *
 * Upserted per wallet rather than as a set, so setting a PEA's opening date
 * does not require having decided on target weights first.
 */
export async function saveWalletPlan(input: {
  wallet: WalletId;
  targetWeight?: string | number;
  openedOn?: string;
  contributionCeiling?: string | number;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = walletPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const { error } = await supabase.from("wallet_plans").upsert(
    {
      user_id: userId,
      wallet: parsed.data.wallet,
      target_weight: parsed.data.targetWeight,
      opened_on: parsed.data.openedOn,
      contribution_ceiling: parsed.data.contributionCeiling,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,wallet" },
  );

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

/**
 * Saves every target at once, across the accounts kept: the wallets' in
 * `wallet_plans`, the savings accounts' in `savings_accounts` (migration 047).
 *
 * Drift is only reported when the targets cover the whole split, so the UI
 * edits them as a set and this writes them as one.
 */
export async function saveAccountTargets(
  targets: { accountId: AccountId; targetWeight: number }[],
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const wallets = targets.filter((row) => !isSavingsAccountId(row.accountId));
  const savings = targets.filter((row) => isSavingsAccountId(row.accountId));

  const parsed = walletTargetsSchema.safeParse({
    targets: wallets.map((row) => ({
      wallet: row.accountId,
      targetWeight: row.targetWeight,
    })),
  });
  if (
    !parsed.success ||
    savings.some(
      (row) =>
        !Number.isFinite(row.targetWeight) ||
        row.targetWeight < 0 ||
        row.targetWeight > 1,
    )
  ) {
    return {
      error: parsed.error?.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const total = targets.reduce((sum, row) => sum + row.targetWeight, 0);

  // Anything else would make every account look permanently off-target.
  if (targets.length > 0 && Math.abs(total - 1) > 0.005) {
    return { error: "errors.targetsMustTotal100" };
  }

  if (parsed.data.targets.length > 0) {
    const { error } = await supabase.from("wallet_plans").upsert(
      parsed.data.targets.map((row) => ({
        user_id: userId,
        wallet: row.wallet,
        target_weight: row.targetWeight,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,wallet" },
    );
    if (error) {
      return { error: error.message };
    }
  }

  for (const row of savings) {
    const { error } = await supabase
      .from("savings_accounts")
      .update({
        target_weight: row.targetWeight,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("kind", row.accountId as SavingsAccountKind);
    if (error) {
      return {
        error:
          error.code === "42703"
            ? "placementsPhone.targetsSetup"
            : error.message,
      };
    }
  }
  return { success: true };
}

/**
 * Commits a reviewed CSV import.
 *
 * The rows arriving here were parsed, de-duplicated and categorised in the
 * review step; this re-validates and writes, so nothing reaches the ledger
 * that has not been through the schema.
 */
export async function importTransactions(
  rows: {
    categoryId: string;
    amount: number;
    occurredOn: string;
    note?: string;
  }[],
): Promise<ActionResult & { imported?: number }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = importTransactionsSchema.safeParse({ rows });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const { error } = await supabase.from("transactions").insert(
    parsed.data.rows.map((row) => ({
      user_id: userId,
      category_id: row.categoryId,
      amount: row.amount,
      occurred_on: row.occurredOn,
      note: row.note?.trim() || null,
    })),
  );

  if (error) {
    return { error: error.message };
  }
  return { success: true, imported: parsed.data.rows.length };
}

/**
 * Deletes several transactions at once.
 *
 * The row-level policy already scopes deletes to the caller; the explicit
 * user_id filter keeps it that way if the policy is ever loosened.
 */
export async function deleteTransactions(
  ids: string[],
): Promise<ActionResult & { deleted?: number }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = deleteTransactionsSchema.safeParse({ ids });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const skipError = await skipWhatTemplatesWrote(
    supabase,
    userId,
    parsed.data.ids,
  );
  if (skipError) {
    return { error: skipError };
  }

  const { error, count } = await supabase
    .from("transactions")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .in("id", parsed.data.ids);

  if (error) {
    return { error: error.message };
  }

  return { success: true, deleted: count ?? parsed.data.ids.length };
}

/**
 * Moves several transactions into another category.
 *
 * The web twin carries the reasoning. The check worth repeating here: the
 * target category is confirmed to belong to this user before the update,
 * because the policy on `transactions` polices which rows may be written and
 * not what they may point at.
 */
export async function moveTransactions(
  ids: string[],
  categoryId: string,
): Promise<ActionResult & { moved?: number }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = moveTransactionsSchema.safeParse({ ids, categoryId });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("user_id", userId)
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
    .eq("user_id", userId)
    .in("id", parsed.data.ids);

  if (error) {
    return { error: error.message };
  }

  return { success: true, moved: count ?? parsed.data.ids.length };
}

/* ------------------------------------------------------------ closing a month */

export async function previewMonthCloseFor(
  year: number,
  month: number,
  closingBalance: number,
): Promise<ActionResult & { result?: MonthCloseResult }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  try {
    const result = await previewMonthClose(
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

export async function recordMonthClose(
  year: number,
  month: number,
  closingBalance: number,
  /** The reader's, for the one refusal that carries a date. */
  locale: Locale,
): Promise<ActionResult & { result?: MonthCloseResult }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const settings = await getMonthCloseSettings(userId);
  const observeOn = observationDateFor(
    parsed.data.year,
    parsed.data.month,
    settings.closeDay,
  );

  // A month cannot be closed before the day its balance is read on: the
  // spending is still landing, and the figure would be measured against a
  // window that has not finished.
  if (todayIsoLocal() < observeOn) {
    return {
      // Composed here, in the reader's language, because it carries a date
      // and a toast can only translate a bare key.
      error: translator(locale)("actions.closeTooEarly", {
        date: formatLongDate(observeOn, locale),
      }),
    };
  }

  try {
    // Worked out before writing, so a rejected reconciliation is never stored
    // and the reveal is the same figure the row will replay to.
    const result = await previewMonthClose(
      userId,
      parsed.data.year,
      parsed.data.month,
      parsed.data.closingBalance,
    );

    const { error } = await supabase.from("month_closes").upsert(
      {
        user_id: userId,
        month: monthColumnValue(parsed.data.year, parsed.data.month),
        closing_balance: parsed.data.closingBalance,
        observed_on: observeOn,
      },
      { onConflict: "user_id,month" },
    );

    if (error) {
      return { error: error.message };
    }

    return { success: true, result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "monthClose.couldNotClose",
    };
  }
}

/** Undo a mistyped balance. The months after it simply re-link. */
export async function deleteMonthClose(
  year: number,
  month: number,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance: 0 });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await supabase
    .from("month_closes")
    .delete()
    .eq("user_id", userId)
    .eq("month", monthColumnValue(parsed.data.year, parsed.data.month));

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "actions.closeRemoved" };
}

export async function updateUnrecordedCap(
  cap: number | null,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = unrecordedCapSchema.safeParse({ cap });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const { error } = await supabase.from("month_close_settings").upsert(
    {
      user_id: userId,
      unrecorded_cap: parsed.data.cap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: parsed.data.cap === null ? "plan.capRemoved" : "actions.capSet",
  };
}

export async function updateCloseDay(closeDay: number): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = closeDaySchema.safeParse({ closeDay });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const { error } = await supabase.from("month_close_settings").upsert(
    {
      user_id: userId,
      close_day: parsed.data.closeDay,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "actions.readingDayUpdated" };
}

/* ------------------------------------------ charges the bank already paid */

/**
 * Confirming, refusing and undoing a fulfilment.
 *
 * Nothing here ever runs on its own. An earlier version of this app matched
 * bank rows to recurring templates automatically, on amount and a five-day
 * window, and had to grow a recovery action for the ones it swallowed — so
 * every one of these is the direct result of a press, and the undo is a
 * first-class action rather than an afterthought.
 *
 * The web twin validates the template and the transaction belong to the
 * caller before writing. Here that check is the database's: row level
 * security scopes every one of these tables to `auth.uid()`, and the phone
 * holds no service-role key with which to reach past it.
 */

const FULFILMENT_SETUP_MESSAGE = "actions.fulfilmentSetup";

/** Yes: that movement is the occurrence this template called for. */
export async function fulfilOccurrence(
  templateId: string,
  occurredOn: string,
  transactionId: string,
  /** The reader's, for the message that names the month it now counts for. */
  locale: Locale,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const [{ data: template }, { data: transaction }] = await Promise.all([
    supabase
      .from("recurring_templates")
      .select("id")
      .eq("id", templateId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!template || !transaction) {
    return { error: "actions.recurringGone" };
  }

  const { error } = await supabase.from("recurring_fulfilments").upsert(
    {
      user_id: userId,
      template_id: templateId,
      occurred_on: occurredOn,
      transaction_id: transactionId,
    },
    { onConflict: "user_id,template_id,occurred_on" },
  );

  if (error) {
    if (isMissingSchema(error)) {
      return { error: FULFILMENT_SETUP_MESSAGE };
    }
    // The unique index on transaction_id is the one worth translating: it
    // means this movement is already standing in for a different occurrence.
    if (error.code === "23505") {
      return {
        error: "actions.movementTaken",
      };
    }
    return { error: error.message };
  }

  // The month fills itself from its charges, so this occurrence may already
  // have a row the template wrote. The movement just confirmed is the real
  // one; the template's row would count the same rent twice.
  const { error: duplicateError } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId)
    .eq("occurred_on", occurredOn);

  if (duplicateError) {
    return { error: duplicateError.message };
  }

  // A planned item counts in the month it was planned for, as on the web
  // (`fulfilOccurrence` there): a payment whose money moved in another month,
  // early or late, moves to the occurrence's day and keeps the day its money
  // moved as `cash_on`.
  const movedOn = cashDateOf(transaction);
  const countsFor = countsForMonthOf({ occurredOn }, movedOn);

  if (countsFor) {
    const { error: moveError } = await supabase
      .from("transactions")
      .update({ occurred_on: occurredOn, cash_on: movedOn })
      .eq("id", transactionId)
      .eq("user_id", userId);
    if (moveError) {
      return {
        error: isMissingSchema(moveError)
          ? "actions.cashDateSetup"
          : moveError.message,
      };
    }
    // Composed here, in the reader's language, because it names a month
    // and a toast can only translate a bare key.
    return {
      success: true,
      message: translator(locale)("actions.countedForMonth", {
        month: monthLong(Number(countsFor.slice(5, 7)), locale),
      }),
    };
  }

  return { success: true, message: "actions.counted" };
}

/**
 * Put an income counted for next month back on the day its money arrived,
 * and undo the confirmation that moved it — the web's `moveBackEarlyIncome`.
 */
export async function moveBackEarlyIncome(
  transactionId: string,
  /** The reader's, for the message that names the day it went back to. */
  locale: Locale,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!transaction?.cash_on) {
    return { error: "actions.transactionNotFound" };
  }

  const { error: unlinkError } = await supabase
    .from("recurring_fulfilments")
    .delete()
    .eq("user_id", userId)
    .eq("transaction_id", transactionId);
  if (unlinkError && !isMissingSchema(unlinkError)) {
    return { error: unlinkError.message };
  }

  const { error } = await supabase
    .from("transactions")
    .update({ occurred_on: transaction.cash_on, cash_on: null })
    .eq("id", transactionId)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: translator(locale)("actions.movedBack", {
      date: formatShortDate(transaction.cash_on, locale),
    }),
  };
}

/** No: that is not what this charge was. */
export async function refuseFulfilment(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { error } = await supabase.from("recurring_fulfilment_refusals").upsert(
    {
      user_id: userId,
      template_id: templateId,
      occurred_on: occurredOn,
      transaction_id: transactionId,
    },
    {
      onConflict: "user_id,template_id,occurred_on,transaction_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    if (isMissingSchema(error)) {
      return { error: FULFILMENT_SETUP_MESSAGE };
    }
    return { error: error.message };
  }

  // Deliberately says what it will and will not do. The refusal names the
  // pair, so a better candidate for the same occurrence is still offered.
  return { success: true, message: "actions.pairingDismissed" };
}

/** Take a confirmation back, and put the occurrence back in the forecast. */
export async function undoFulfilment(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  // The row this confirmation moved, if it moved one, goes back too.
  const { data: fulfilment } = await supabase
    .from("recurring_fulfilments")
    .select("transaction_id")
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn)
    .maybeSingle();

  const { error } = await supabase
    .from("recurring_fulfilments")
    .delete()
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn);

  if (error) {
    if (isMissingSchema(error)) {
      return { error: FULFILMENT_SETUP_MESSAGE };
    }
    return { error: error.message };
  }

  if (fulfilment?.transaction_id) {
    const { data: moved } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", fulfilment.transaction_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (moved?.cash_on && moved.occurred_on === occurredOn) {
      await supabase
        .from("transactions")
        .update({ occurred_on: moved.cash_on, cash_on: null })
        .eq("id", moved.id)
        .eq("user_id", userId);
    }
  }

  return { success: true, message: "actions.backInForecast" };
}

/* ---------------------------------------------------- the review inbox */

/**
 * Deciding what a bank row was.
 *
 * Three decisions, following the web server actions in `lib/actions/bank.ts`:
 * file it under a category, leave it out, or take the decision back. The
 * phone writes them through Supabase directly, under the same row-level
 * security every other mutation here relies on, because the web actions exist
 * only to give a browser a server — they hold no secret the phone lacks.
 *
 * Until now none of these existed on the phone at all, so a bank feed the
 * cron filled with six entries needing a category could only be answered on
 * the web app.
 */

/**
 * Accept one waiting row into the ledger, under the category the user picked.
 *
 * The same duplicate check the sync does, because pressing Add is no less
 * likely to double-record a movement: a card fee written by a recurring
 * template days earlier is still there whichever path the bank's copy arrives
 * by. `force` is how the user says they know better — two identical coffees
 * on the same day are two coffees.
 */
export async function importFeedItem(
  itemId: string,
  categoryId: string,
  force = false,
): Promise<ActionResult & { duplicateOf?: string }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { data: item } = await supabase
    .from("bank_feed_items")
    .select("id, occurred_on, amount, note, status, direction")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!item) {
    return { error: "actions.entryNoLongerWaiting" };
  }
  if (item.status !== "pending") {
    return { error: "actions.entryAlreadyDealtWith" };
  }

  if (!force) {
    const existing = await ledgerRowsAround(userId, item.occurred_on);
    const already = findLedgerMatch(
      {
        providerId: "",
        occurredOn: item.occurred_on,
        amount: String(item.amount),
        currency: "EUR",
        direction: item.direction,
        counterparty: null,
        merchantCategoryCode: null,
        balanceAfter: null,
        note: item.note,
      },
      existing,
    );

    if (already) {
      const { error: matchError } = await supabase
        .from("bank_feed_items")
        .update({
          status: "imported",
          transaction_id: already.transactionId,
          // Recorded as a match, because that is what it is: this row was
          // filed against a transaction that was already there rather than
          // one it wrote. Undo reads this to decide whether the transaction
          // is its to delete — see `undoFeedDecision`.
          decided_by: "match:ledger",
        })
        .eq("id", itemId)
        .eq("user_id", userId);
      if (matchError) {
        return { error: matchError.message };
      }

      return {
        success: true,
        duplicateOf: already.transactionId,
        message: "actions.alreadyInLedger",
      };
    }
  }

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      category_id: categoryId,
      occurred_on: item.occurred_on,
      amount: item.amount,
      note: item.note,
    })
    .select("id")
    .single();

  if (error || !transaction) {
    return { error: error?.message ?? "actions.couldNotAddEntry" };
  }

  const { error: fileError } = await supabase
    .from("bank_feed_items")
    .update({ status: "imported", transaction_id: transaction.id })
    .eq("id", itemId)
    .eq("user_id", userId);
  if (fileError) {
    // Taken back, so the row and the ledger agree: a transaction whose bank
    // row still waits would be filed a second time by the next answer.
    await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id)
      .eq("user_id", userId);
    return { error: fileError.message };
  }

  return { success: true, message: "recurringProposals.added" };
}

/**
 * Leave one out of the ledger for good.
 *
 * Kept rather than deleted, so the next sync does not offer it again — the
 * provider keeps returning it for as long as it is in the statement window.
 */
export async function ignoreFeedItem(itemId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { error } = await supabase
    .from("bank_feed_items")
    .update({ status: "ignored" })
    .eq("id", itemId)
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "actions.leftOut" };
}

/**
 * Whether this row's transaction belongs to something else.
 *
 * `decided_by` records how the row was settled, and two of its three shapes
 * mean "filed against a transaction that was already there":
 * `match:recurring` when the sync paired it with a recurring charge, and
 * `match:ledger` when pressing Add found the movement already recorded. Only
 * `auto:` and a category picked by hand actually write a transaction.
 */
function matchedExistingTransaction(decidedBy: string | null): boolean {
  return decidedBy?.startsWith("match:") ?? false;
}

/**
 * Take back a decision and put the row back in the inbox.
 *
 * For something this row added, the ledger row it created goes with it:
 * leaving the transaction behind while the bank row returns to the inbox is
 * how the same expense gets recorded twice. For something left out there is
 * nothing to remove, and it simply comes back.
 *
 * But not every decided row wrote a transaction. A row can be filed *against*
 * one that was already there — the sync does it when a recurring charge looks
 * to be the same movement, and pressing Add does it when the duplicate check
 * finds the amount already recorded, which is the "Already in your ledger"
 * message. Deleting whatever `transaction_id` points at either way takes out
 * a transaction the user entered themselves and puts the bank row back to
 * pending, leaving the ledger quietly a row short with nothing to say it
 * happened. The web twin carries the same guard.
 *
 * There is no `recategoriseFeedItem` here, unlike the web. Its reason to
 * exist is that changing a filed row's category must not change the
 * transaction's id, since a tag or a closed month may already point at it.
 * The phone's inbox only offers Undo on rows decided seconds earlier in the
 * same sitting, where nothing can be pointing at them yet, and undoing puts
 * the row back at the front of the queue with the picker already open —
 * which reaches the same place in one tap.
 */
export async function undoFeedDecision(itemId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { data: item } = await supabase
    .from("bank_feed_items")
    .select("transaction_id, status, decided_by")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!item) {
    return { error: "actions.entryNoLongerHere" };
  }
  if (item.status === "pending") {
    return { error: "actions.entryAlreadyWaiting" };
  }

  // The feed row first: if deleting the transaction succeeded and this then
  // failed, the row would point at a transaction that no longer exists.
  // `decided_by` goes too, as on the web: a row put back after a match must
  // not carry `match:` into its next decision, where it would stop a later
  // undo from deleting the transaction that decision wrote.
  const { error } = await supabase
    .from("bank_feed_items")
    .update({ status: "pending", transaction_id: null, decided_by: null })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  if (item.transaction_id && !matchedExistingTransaction(item.decided_by)) {
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", item.transaction_id)
      .eq("user_id", userId);

    if (deleteError) {
      return { error: deleteError.message };
    }
  }

  return { success: true, message: "actions.backInInbox" };
}

/* ------------------------------------------------- the bank's accounts */

/**
 * Whether one of the bank's accounts is spending money — counted in the
 * balance Le point carries and the month close reads — or kept apart, as a
 * savings account the bank happens to hold. The web's
 * `setAccountCountsAsCash`; the phone writes it through Supabase like every
 * other mutation here, rather than from the screen that shows the switch.
 */
export async function setAccountCountsAsCash(
  providerAccountId: string,
  counts: boolean,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { error } = await supabase
    .from("bank_accounts")
    .update({ counts_as_cash: counts })
    .eq("user_id", userId)
    .eq("provider_account_id", providerAccountId);

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}
