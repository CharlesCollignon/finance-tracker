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
import { todayIsoLocal, formatLongDate } from "@finance/core/constants";
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
  ledgerRowsAround,
  previewMonthClose,
} from "@/lib/queries";
import { findLedgerMatch } from "@finance/core/bank-feed";
import type {
  SavingsAccountKind,
  WalletId,
} from "@finance/core/types/database";

import { saveRecurringTemplate } from "@finance/data/recurring-templates";
import * as categories from "@finance/data/categories";
import * as decisions from "@finance/data/fulfilment-decisions";
import * as ledger from "@finance/data/ledger";
import * as occurrences from "@finance/data/occurrences";
import type { ActionResult } from "@finance/core/action-result";
import { supabase } from "@/lib/supabase";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";

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
