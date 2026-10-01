import {
  authSchema,
  recurringTemplateSchema,
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
import { type MonthCloseResult } from "@finance/core/month-close";
import type {
  SavingsAccountKind,
  WalletId,
} from "@finance/core/types/database";

import { saveRecurringTemplate } from "@finance/data/recurring-templates";
import * as categories from "@finance/data/categories";
import * as closing from "@finance/data/closing";
import * as feed from "@finance/data/feed-decisions";
import * as decisions from "@finance/data/fulfilment-decisions";
import * as ledger from "@finance/data/ledger";
import * as occurrences from "@finance/data/occurrences";
import type { ActionResult } from "@finance/core/action-result";
import { supabase } from "@/lib/supabase";
import type { Locale } from "@finance/core/i18n/locale";

async function requireUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Run a write as the signed-in user: the phone's counterpart of the web's
 * `asUser`. No redraw to ask for — the client's fetch has already announced
 * the write to every screen that reads it.
 */
async function asUser<T extends object>(
  work: (userId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" } as ActionResult<T>;
  }
  return work(userId);
}

export async function createTransaction(
  input: ledger.NewTransaction,
): Promise<ActionResult> {
  return asUser((userId) => ledger.createTransaction(supabase, userId, input));
}

export async function updateTransaction(
  input: ledger.TransactionChange,
): Promise<ActionResult> {
  return asUser((userId) => ledger.updateTransaction(supabase, userId, input));
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  return asUser((userId) => ledger.deleteTransaction(supabase, userId, id));
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

export async function upsertCategory(
  input: Omit<categories.CategoryChange, "icon"> & { icon?: string | null },
): Promise<ActionResult> {
  return asUser((userId) =>
    categories.upsertCategory(supabase, userId, {
      ...input,
      icon: input.icon ?? undefined,
    }),
  );
}

export async function setCategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  return asUser((userId) =>
    categories.setCategoryArchived(supabase, userId, id, archived),
  );
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  return asUser((userId) => categories.deleteCategory(supabase, userId, id));
}

export async function unskipRecurringOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  return asUser((userId) =>
    occurrences.unskipRecurringOccurrence(
      supabase,
      userId,
      templateId,
      occurredOn,
    ),
  );
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
  return asUser((userId) =>
    occurrences.deleteRecurringTemplate(supabase, userId, id),
  );
}

export async function toggleRecurringActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  return asUser((userId) =>
    occurrences.toggleRecurringActive(supabase, userId, id, active),
  );
}

/** Write the charges whose day has come — `@finance/data/occurrences`. */
export async function fillThisMonth(): Promise<{
  created: number;
  error?: string;
}> {
  const userId = await requireUserId();
  return userId ? occurrences.fillThisMonth(supabase, userId) : { created: 0 };
}

export async function recordPlannedNow(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult<{ transactionId: string }>> {
  return asUser((userId) =>
    occurrences.recordPlannedNow(supabase, userId, templateId, occurredOn),
  );
}

export async function undoRecordPlanned(
  transactionId: string,
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  return asUser((userId) =>
    occurrences.undoRecordPlanned(
      supabase,
      userId,
      transactionId,
      templateId,
      occurredOn,
    ),
  );
}

export async function skipPlannedOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  return asUser((userId) =>
    occurrences.skipPlannedOccurrence(supabase, userId, templateId, occurredOn),
  );
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
  rows: ledger.ImportedRow[],
): Promise<ActionResult<{ imported: number }>> {
  return asUser((userId) => ledger.importTransactions(supabase, userId, rows));
}

/**
 * Deletes several transactions at once.
 *
 * The row-level policy already scopes deletes to the caller; the explicit
 * user_id filter keeps it that way if the policy is ever loosened.
 */
export async function deleteTransactions(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  return asUser((userId) => ledger.deleteTransactions(supabase, userId, ids));
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
): Promise<ActionResult<{ moved: number }>> {
  return asUser((userId) =>
    ledger.moveTransactions(supabase, userId, ids, categoryId),
  );
}

/* ------------------------------------------------------------ closing a month */

/** Closing a month — `@finance/data/closing`, the same writes as the web's. */

export async function previewMonthCloseFor(
  year: number,
  month: number,
  closingBalance: number,
): Promise<ActionResult<{ result: MonthCloseResult }>> {
  return asUser((userId) =>
    closing.previewClose(supabase, userId, year, month, closingBalance),
  );
}

export async function recordMonthClose(
  year: number,
  month: number,
  closingBalance: number,
  locale: Locale,
): Promise<ActionResult<{ result: MonthCloseResult }>> {
  return asUser((userId) =>
    closing.recordMonthClose(
      supabase,
      userId,
      year,
      month,
      closingBalance,
      locale,
    ),
  );
}

export async function deleteMonthClose(
  year: number,
  month: number,
): Promise<ActionResult> {
  return asUser((userId) =>
    closing.deleteMonthClose(supabase, userId, year, month),
  );
}

export async function updateUnrecordedCap(
  cap: number | null,
): Promise<ActionResult> {
  return asUser((userId) => closing.updateUnrecordedCap(supabase, userId, cap));
}

export async function updateCloseDay(closeDay: number): Promise<ActionResult> {
  return asUser((userId) => closing.updateCloseDay(supabase, userId, closeDay));
}

/* ------------------------------------------ charges the bank already paid */

/**
 * Confirming, refusing and undoing a fulfilment —
 * `@finance/data/fulfilment-decisions`, the same writes as the web's.
 * Nothing here runs on its own: every one is the direct result of a press.
 */

/** Yes: that movement is the occurrence this template called for. */
export async function fulfilOccurrence(
  templateId: string,
  occurredOn: string,
  transactionId: string,
  locale: Locale,
): Promise<ActionResult> {
  return asUser((userId) =>
    decisions.fulfilOccurrence(
      supabase,
      userId,
      templateId,
      occurredOn,
      transactionId,
      locale,
    ),
  );
}

/** Put an income counted for next month back on the day it arrived. */
export async function moveBackEarlyIncome(
  transactionId: string,
  locale: Locale,
): Promise<ActionResult> {
  return asUser((userId) =>
    decisions.moveBackEarlyIncome(supabase, userId, transactionId, locale),
  );
}

/** No: that is not what this charge was. */
export async function refuseFulfilment(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  return asUser((userId) =>
    decisions.refuseFulfilment(
      supabase,
      userId,
      templateId,
      occurredOn,
      transactionId,
    ),
  );
}

/* ---------------------------------------------------- the review inbox */

/**
 * Filing, leaving out and putting back one bank row —
 * `@finance/data/feed-decisions`, the same rules as the web's and the
 * group decisions the web's `/api/bank/feed` route takes.
 */

export async function importFeedItem(
  itemId: string,
  categoryId: string,
  force = false,
): Promise<ActionResult<{ duplicateOf?: string }>> {
  return asUser((userId) =>
    feed.importFeedItem(supabase, userId, itemId, categoryId, force),
  );
}

export async function ignoreFeedItem(itemId: string): Promise<ActionResult> {
  return asUser((userId) => feed.ignoreFeedItem(supabase, userId, itemId));
}

export async function undoFeedDecision(itemId: string): Promise<ActionResult> {
  return asUser((userId) => feed.undoFeedDecision(supabase, userId, itemId));
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
