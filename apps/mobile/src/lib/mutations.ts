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
import {
  budgetSchema,
  savingsGoalSchema,
  tagSchema,
} from "@finance/core/validations/phase4";
import {
  getCurrentMonth,
  getMonthBounds,
  shiftIsoDate,
  todayIsoLocal,
  formatLongDate,
} from "@finance/core/constants";
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
import {
  buildApplyRecurringPlan,
  calledForKeys,
  countRecurringToApply,
  followTemplateUpdates,
  forecastsNoLongerCalledFor,
  pastOccurrencesNotWritten,
  recurringOccurrenceKey,
  scheduleDatesBefore,
  type RecurringOccurrenceUpdate,
} from "@finance/core/apply-recurring";
import { resolveRecurringAmount } from "@finance/core/recurring-shares";
import { resolveWalletId } from "@finance/core/investments";
import { displayNameForRecurringTemplate } from "@finance/core/investment-positions";
import {
  BITCOIN_INSTRUMENT,
  isCryptoCategoryName,
  isCryptoWallet,
} from "@finance/core/crypto-holdings";
import type {
  CategoryType,
  Database,
  RecurringTemplateWithCategory,
  WalletId,
} from "@finance/core/types/database";

import { quoteSource } from "@/lib/quote-source";
import { supabase } from "@/lib/supabase";
import { DEFAULT_LOCALE } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";

type ActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
  /** Set by creates, so callers can write related rows (tags). */
  id?: string;
};

type RecurringTemplateInsert =
  Database["public"]["Tables"]["recurring_templates"]["Insert"];
type RecurringTemplateUpdate =
  Database["public"]["Tables"]["recurring_templates"]["Update"];

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

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      category_id: parsed.data.categoryId,
      amount: parsed.data.amount,
      occurred_on: parsed.data.occurredOn,
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }
  return { success: true, id: data?.id as string | undefined };
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
    const skipError = await skipOccurrences(userId, [
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
  const skipError = await skipWhatTemplatesWrote(userId, [id]);
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
      userId,
      year!,
      month!,
      todayIsoLocal(),
      new Set([recurringOccurrenceKey(templateId, occurredOn)]),
    );
  }

  return { success: true };
}

/** Replaces a transaction's tags wholesale, mirroring the web action. */
export async function setTransactionTags(
  transactionId: string,
  tagIds: string[],
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const { data: tx } = await supabase
    .from("transactions")
    .select("id")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!tx) {
    return { error: "actions.transactionNotFound" };
  }

  await supabase
    .from("transaction_tags")
    .delete()
    .eq("transaction_id", transactionId);

  if (tagIds.length > 0) {
    const { error } = await supabase.from("transaction_tags").insert(
      tagIds.map((tagId) => ({
        transaction_id: transactionId,
        tag_id: tagId,
      })),
    );
    if (error) {
      return { error: error.message };
    }
  }

  return { success: true };
}

async function syncInvestmentPositionFromRecurring(
  userId: string,
  templateId: string,
): Promise<void> {
  const { data: template, error } = await supabase
    .from("recurring_templates")
    .select("*, categories(name, type, icon, counts_toward_summary)")
    .eq("id", templateId)
    .eq("user_id", userId)
    .single();

  if (error || !template) {
    return;
  }

  const row = template as RecurringTemplateWithCategory;
  if (
    row.categories.type !== "investment" ||
    row.categories.counts_toward_summary !== false
  ) {
    return;
  }

  const wallet = resolveWalletId(row.categories.name);
  const name = displayNameForRecurringTemplate(row);
  const isCrypto = isCryptoWallet(wallet);
  const hasInstrument =
    isCrypto ||
    (row.instrument_symbol !== null && row.instrument_name !== null);
  const instrumentSymbol = isCrypto
    ? BITCOIN_INSTRUMENT.symbol
    : row.instrument_symbol;
  const instrumentName = isCrypto
    ? BITCOIN_INSTRUMENT.name
    : row.instrument_name;

  const { data: existing } = await supabase
    .from("investment_positions")
    .select("id")
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("investment_positions")
      .update({
        wallet,
        name,
        category_id: row.category_id,
        updated_at: new Date().toISOString(),
        ...(hasInstrument
          ? {
              instrument_symbol: instrumentSymbol,
              instrument_name: instrumentName,
            }
          : {}),
      })
      .eq("id", existing.id)
      .eq("user_id", userId);
    return;
  }

  await supabase.from("investment_positions").insert({
    user_id: userId,
    wallet,
    recurring_template_id: templateId,
    name,
    category_id: row.category_id,
    initial_balance: 0,
    current_value: null,
    share_count: null,
    instrument_symbol: hasInstrument ? instrumentSymbol : null,
    instrument_name: hasInstrument ? instrumentName : null,
  });
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

  const schedule =
    data.recurrence === "monthly"
      ? {
          recurrence: "monthly" as const,
          day_of_month: data.dayOfMonth,
          day_of_week: null,
          month_of_year: null,
        }
      : data.recurrence === "weekly"
        ? {
            recurrence: "weekly" as const,
            day_of_month: null,
            day_of_week: data.dayOfWeek,
            month_of_year: null,
          }
        : {
            recurrence: "yearly" as const,
            month_of_year: data.monthOfYear,
            day_of_month: data.dayOfMonth,
            day_of_week: null,
          };

  const base = {
    category_id: data.categoryId,
    amount,
    active: data.active ?? true,
    description: data.description?.trim() || null,
    starts_on: data.startsOn ?? null,
    ends_on: data.endsOn ?? null,
    ...pricingPayload,
    ...schedule,
  };

  let templateId = data.id;

  // What the template said before this save, so the rows it already wrote
  // can tell whether they have been moved to another day or stopped.
  const { data: previous } = data.id
    ? await supabase
        .from("recurring_templates")
        .select(
          "recurrence, day_of_month, day_of_week, month_of_year, starts_on, ends_on, active",
        )
        .eq("id", data.id)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  if (data.id) {
    const updatePayload: RecurringTemplateUpdate = base;
    const { error } = await supabase
      .from("recurring_templates")
      .update(updatePayload)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) {
      return { error: error.message };
    }
  } else {
    const insertPayload: RecurringTemplateInsert = {
      user_id: userId,
      ...base,
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
    await syncInvestmentPositionFromRecurring(userId, templateId);
  }

  // The ledger follows the template straight away rather than on the next
  // open. A failure here does not undo a save that worked: the month fills
  // itself again the next time the app opens.
  if (templateId && !(await hasBankFeed(userId))) {
    const today = todayIsoLocal();
    try {
      if (previous === null) {
        // New. It starts from the next date to come — `isDue` sees to that —
        // unless the user said this month's had already happened.
        if (input.startThisMonth === true) {
          const { year, month } = getCurrentMonth();
          const id = templateId;
          await fillMonth(
            userId,
            year,
            month,
            today,
            new Set(
              scheduleDatesBefore(
                {
                  recurrence: schedule.recurrence,
                  day_of_month: schedule.day_of_month ?? null,
                  day_of_week: schedule.day_of_week ?? null,
                  month_of_year: schedule.month_of_year ?? null,
                  starts_on: base.starts_on,
                  ends_on: base.ends_on,
                },
                year,
                month,
                today,
              ).map((date) => recurringOccurrenceKey(id, date)),
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
        await followTemplate(userId, templateId, {
          today,
          from:
            input.applyToThisMonth === true
              ? firstOfCurrentMonth()
              : shiftIsoDate(today, 1),
          reschedule,
        });
      }
    } catch {
      // See above.
    }
  }

  return { success: true };
}

/** The first day of the month in progress. */
function firstOfCurrentMonth(): string {
  const { year, month } = getCurrentMonth();
  return getMonthBounds(year, month).start;
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
      await followTemplate(userId, id, {
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

async function loadApplyRecurringData(
  userId: string,
  year: number,
  month: number,
) {
  const { start, end } = getMonthBounds(year, month);

  const [
    { data: templates, error: tplError },
    { data: transactions, error: txError },
    { data: skips, error: skipError },
    { data: fulfilments, error: fulfilmentError },
  ] = await Promise.all([
    supabase
      .from("recurring_templates")
      .select("*, categories(name, type, icon, counts_toward_summary)")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("transactions")
      .select(
        "id, amount, note, category_id, recurring_template_id, occurred_on",
      )
      .eq("user_id", userId)
      .not("recurring_template_id", "is", null)
      .gte("occurred_on", start)
      .lte("occurred_on", end),
    supabase
      .from("recurring_skips")
      .select("template_id, occurred_on")
      .eq("user_id", userId)
      .gte("occurred_on", start)
      .lte("occurred_on", end),
    supabase
      .from("recurring_fulfilments")
      .select("template_id, occurred_on")
      .eq("user_id", userId)
      .gte("occurred_on", start)
      .lte("occurred_on", end),
  ]);

  if (tplError) {
    throw new Error(tplError.message);
  }
  if (txError) {
    throw new Error(txError.message);
  }
  if (skipError) {
    throw new Error(skipError.message);
  }
  // Missing only before migration 023, where nothing can have been fulfilled.
  if (fulfilmentError && !fulfilmentSchemaMissing(fulfilmentError)) {
    throw new Error(fulfilmentError.message);
  }

  const existingByKey = new Map<
    string,
    {
      id: string;
      amount: number;
      note: string | null;
      category_id: string;
    }
  >();

  for (const tx of transactions ?? []) {
    if (!tx.recurring_template_id) {
      continue;
    }
    existingByKey.set(`${tx.recurring_template_id}:${tx.occurred_on}`, {
      id: tx.id,
      amount: Number(tx.amount),
      note: tx.note,
      category_id: tx.category_id,
    });
  }

  // A fulfilled occurrence is already in the ledger, as the movement the
  // user confirmed it was. Writing the template's row as well would count it
  // twice, so to anything that writes it is as good as skipped.
  const skippedKeys = new Set(
    [...(skips ?? []), ...(fulfilments ?? [])].map(
      (row) => `${row.template_id}:${row.occurred_on}`,
    ),
  );

  return {
    templates: (templates ?? []) as RecurringTemplateWithCategory[],
    existingByKey,
    skippedKeys,
  };
}

/** PostgreSQL's unique-violation code: the row is already there. */
const ALREADY_WRITTEN = "23505";

/**
 * Bring each quote-priced template's stored price up to date — the price the
 * rows just written were priced at becomes the fallback for a month whose
 * quote cannot be fetched. The web twin's `refreshTemplateQuotes`.
 */
async function refreshTemplateQuotes(
  userId: string,
  templates: readonly RecurringTemplateWithCategory[],
): Promise<void> {
  for (const template of templates) {
    let quoteUpdate: {
      amount: number;
      last_quote_price: number;
      last_quote_at: string;
    } | null = null;

    try {
      const resolved = await resolveRecurringAmount(
        {
          pricing_type: template.pricing_type ?? "fixed",
          amount: Number(template.amount),
          share_count: template.share_count,
          instrument_symbol: template.instrument_symbol,
          instrument_name: template.instrument_name,
          description: template.description,
          last_quote_price: template.last_quote_price,
        },
        quoteSource,
      );
      quoteUpdate = resolved.quoteUpdate;
    } catch {
      // No price and nothing to fall back to: leave the stored figures be.
      continue;
    }

    if (!quoteUpdate) {
      continue;
    }

    await supabase
      .from("recurring_templates")
      .update(quoteUpdate)
      .eq("id", template.id)
      .eq("user_id", userId);
  }
}

/** Write amount, note and category through to rows already written. */
async function writeOccurrenceUpdates(
  userId: string,
  updates: readonly RecurringOccurrenceUpdate[],
): Promise<string[]> {
  const failures: string[] = [];
  for (const item of updates) {
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: item.amount,
        note: item.note,
        category_id: item.categoryId,
      })
      .eq("id", item.transactionId)
      .eq("user_id", userId);

    if (error) {
      failures.push(error.message);
    }
  }
  return failures;
}

/**
 * Write the occurrences of one month whose day has come and that are not in
 * the ledger yet.
 *
 * Only what is due — see `isDue`. Everything after today stays planned: the
 * ledger draws it from the template, and it is written here on its day. The
 * web twin in `lib/recurring-apply.ts` carries the rest of the reasoning: only
 * `toCreate` is written, because a row that differs from its template may be
 * one the user corrected; the question "is anything missing?" is asked first
 * without pricing anything; and two runs at once are safe, because the unique
 * index on (template, date) turns the slower one's inserts into no-ops.
 *
 * `only` writes named occurrences whose day has come, even from before the
 * template was set up — the user asking for them by name — without filling
 * in anything else. The caller decides whether templates may write at all:
 * with a bank feed they only forecast.
 */
async function fillMonth(
  userId: string,
  year: number,
  month: number,
  today: string,
  only?: ReadonlySet<string>,
): Promise<{ created: number; failures: string[] }> {
  const { templates, existingByKey, skippedKeys } =
    await loadApplyRecurringData(userId, year, month);

  // Named occurrences are checked against today only; the rest must be due.
  const dueBy = only ? undefined : today;

  const waiting = countRecurringToApply(
    templates,
    new Set(existingByKey.keys()),
    year,
    month,
    skippedKeys,
    dueBy,
  );
  if (waiting === 0) {
    return { created: 0, failures: [] };
  }

  const plan = await buildApplyRecurringPlan(
    templates,
    existingByKey,
    year,
    month,
    { locale: DEFAULT_LOCALE, quotes: quoteSource, skippedKeys, today, dueBy },
  );

  let created = 0;
  const failures: string[] = [];
  const priced = new Set<string>();

  for (const item of plan.toCreate) {
    if (
      only &&
      (!only.has(recurringOccurrenceKey(item.templateId, item.occurredOn)) ||
        item.occurredOn > today)
    ) {
      continue;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      category_id: item.categoryId,
      recurring_template_id: item.templateId,
      occurred_on: item.occurredOn,
      amount: item.amount,
      note: item.note,
    });

    if (error) {
      if (error.code !== ALREADY_WRITTEN) {
        failures.push(error.message);
      }
      continue;
    }

    created += 1;
    if (item.pricedFromQuote) {
      priced.add(item.templateId);
    }
  }

  if (priced.size > 0) {
    await refreshTemplateQuotes(
      userId,
      templates.filter((template) => priced.has(template.id)),
    );
  }

  // Not anyone's decision: a market move. The server's daily run does this
  // too; here it is free, because the write is already open.
  failures.push(...(await writeOccurrenceUpdates(userId, plan.toReprice)));

  return { created, failures };
}

/** The month before, and this one: what a fill looks at. */
function fillWindow(): { year: number; month: number }[] {
  const current = getCurrentMonth();
  const previous =
    current.month === 1
      ? { year: current.year - 1, month: 12 }
      : { year: current.year, month: current.month - 1 };
  return [previous, current];
}

/**
 * Write every occurrence that has come due and is not written yet, in the
 * month before as well as this one — a charge on the 31st that nobody opened
 * the app for would otherwise slip through when the month turned. Looking
 * back is safe because only due occurrences are written.
 */
async function fillDue(
  userId: string,
  today: string,
): Promise<{ created: number; failures: string[] }> {
  let created = 0;
  const failures: string[] = [];

  for (const { year, month } of fillWindow()) {
    const result = await fillMonth(userId, year, month, today);
    created += result.created;
    failures.push(...result.failures);
  }

  return { created, failures };
}

/**
 * Bring what one template has written in line with it, right after the user
 * changed it.
 *
 * The months ahead need nothing: their occurrences are planned, drawn from
 * the template whenever the ledger is read. What is left is the rows already
 * written, and `from` is the user's answer to "apply this change to…" —
 * tomorrow for upcoming only, the first of this month for this month too.
 * Rows from then on follow the template; rows before it keep what they say,
 * and past months are never reached.
 *
 * When `reschedule` is set — moved to another day, stopped, or started again
 * — the days its new schedule calls for that have already come, this month
 * and last, are skipped rather than filled, and rows written ahead of today
 * that it no longer calls for are removed. See the web twin for why that is
 * the caller's to set.
 */
async function followTemplate(
  userId: string,
  templateId: string,
  options: { today: string; from: string; reschedule: boolean },
): Promise<{ failures: string[] }> {
  const { today, from, reschedule } = options;
  const failures: string[] = [];

  if (reschedule) {
    for (const { year, month } of fillWindow()) {
      const { templates, existingByKey, skippedKeys } =
        await loadApplyRecurringData(userId, year, month);
      const skipError = await skipOccurrences(
        userId,
        pastOccurrencesNotWritten(
          templates.filter((template) => template.id === templateId),
          new Set(existingByKey.keys()),
          year,
          month,
          skippedKeys,
          today,
        ),
      );
      if (skipError) {
        failures.push(skipError);
      }
    }
  }

  const filled = await fillDue(userId, today);
  failures.push(...filled.failures);

  const { data: rows, error } = await supabase
    .from("transactions")
    .select("id, occurred_on")
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId)
    .gte("occurred_on", from < today ? from : today);

  if (error) {
    return { failures: [...failures, error.message] };
  }

  const months = new Set(
    (rows ?? []).map((row) => String(row.occurred_on).slice(0, 7)),
  );

  for (const monthKey of months) {
    const [year, month] = monthKey.split("-").map(Number);
    if (!year || !month) {
      continue;
    }

    const { templates, existingByKey, skippedKeys } =
      await loadApplyRecurringData(userId, year, month);
    const plan = await buildApplyRecurringPlan(
      templates,
      existingByKey,
      year,
      month,
      { locale: DEFAULT_LOCALE, quotes: quoteSource, skippedKeys, today },
    );

    failures.push(
      ...(await writeOccurrenceUpdates(
        userId,
        followTemplateUpdates(plan, templateId, from),
      )),
    );

    if (!reschedule) {
      continue;
    }

    const stale = forecastsNoLongerCalledFor(
      (rows ?? [])
        .filter((row) => String(row.occurred_on).startsWith(monthKey))
        .map((row) => ({
          id: row.id as string,
          templateId,
          occurredOn: String(row.occurred_on),
        })),
      calledForKeys(templates, year, month, skippedKeys),
      today,
    );

    if (stale.length > 0) {
      const { error: removeError } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .in("id", stale);
      if (removeError) {
        failures.push(removeError.message);
      }
    }
  }

  return { failures };
}

/**
 * Take away the rows a template wrote ahead of today, before the template
 * goes. Once it is deleted its rows lose the link that says where they came
 * from, and a charge nobody pays any more would sit in next week's ledger as
 * an ordinary transaction. Today's row stays: it has been recorded.
 */
async function removeTemplateForecasts(
  userId: string,
  templateId: string,
  today: string,
): Promise<string | null> {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("recurring_template_id", templateId)
    .gt("occurred_on", today);

  return error?.message ?? null;
}

/**
 * Remember that the user took an occurrence out of its month, so filling the
 * month does not write it straight back. Deleting a row a template wrote, or
 * moving it to another date, would otherwise only last until the app next
 * opened.
 */
async function skipOccurrences(
  userId: string,
  occurrences: readonly { templateId: string; occurredOn: string }[],
): Promise<string | null> {
  if (occurrences.length === 0) {
    return null;
  }

  const { error } = await supabase.from("recurring_skips").upsert(
    occurrences.map((occurrence) => ({
      user_id: userId,
      template_id: occurrence.templateId,
      occurred_on: occurrence.occurredOn,
    })),
    // Only ever inserted: the table has no update policy, so a skip that
    // is already there has to be left alone rather than written over.
    { onConflict: "user_id,template_id,occurred_on", ignoreDuplicates: true },
  );

  return error?.message ?? null;
}

/**
 * Record a skip for every row in `ids` that a template wrote, before those
 * rows are deleted. Deleting it is the user saying that occurrence should not
 * exist, which is what a skip is.
 */
async function skipWhatTemplatesWrote(
  userId: string,
  ids: string[],
): Promise<string | null> {
  const { data: rows, error } = await supabase
    .from("transactions")
    .select("recurring_template_id, occurred_on")
    .eq("user_id", userId)
    .in("id", ids)
    .not("recurring_template_id", "is", null);

  if (error) {
    return error.message;
  }

  return skipOccurrences(
    userId,
    (rows ?? []).flatMap((row) =>
      row.recurring_template_id
        ? [
            {
              templateId: row.recurring_template_id as string,
              occurredOn: row.occurred_on as string,
            },
          ]
        : [],
    ),
  );
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
    const { created, failures } = await fillDue(userId, todayIsoLocal());
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

  const skipError = await skipOccurrences(userId, [
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

  const skipError = await skipOccurrences(userId, [
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

export async function upsertBudget(input: {
  id?: string;
  categoryId?: string | null;
  amount: number;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const payload = {
    category_id: parsed.data.categoryId ?? null,
    amount: parsed.data.amount,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("budgets")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("user_id", userId);
    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("budgets").insert({
      user_id: userId,
      ...payload,
    });
    if (error) {
      return { error: error.message };
    }
  }
  return { success: true };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

/** A duplicate name, from `unique (user_id, name)` in 012, in the catalogue's words. */
function tagWriteError(error: { code?: string; message: string }): string {
  return error.code === "23505" ? "errors.tagNameTaken" : error.message;
}

export async function upsertTag(name: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = tagSchema.safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }
  const { error } = await supabase.from("tags").insert({
    user_id: userId,
    name: parsed.data.name,
  });
  if (error) {
    return { error: tagWriteError(error) };
  }
  return { success: true };
}

export async function renameTag(
  id: string,
  name: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = tagSchema.safeParse({ id, name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }
  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: tagWriteError(error) };
  }
  return { success: true };
}

/** Deletes a tag; `transaction_tags` cascades, and the transactions stay. */
export async function deleteTag(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

/** Moves every transaction from one tag to another, then deletes the first (040). */
export async function mergeTags(
  fromId: string,
  intoId: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error } = await supabase.rpc("merge_tags", {
    target_user: userId,
    from_tag: fromId,
    into_tag: intoId,
  });
  if (error) {
    return { error: "errors.tagMergeFailed" };
  }
  return { success: true };
}

export async function upsertSavingsGoal(input: {
  id?: string;
  name: string;
  targetAmount: number;
  targetDate?: string;
  startsOn?: string;
  categoryId?: string | null;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = savingsGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const payload = {
    name: parsed.data.name,
    target_amount: parsed.data.targetAmount,
    target_date: parsed.data.targetDate || null,
    category_id: parsed.data.categoryId ?? null,
    // Absent means "keep what it was" on an edit and "today" on a new goal.
    ...(parsed.data.startsOn ? { starts_on: parsed.data.startsOn } : {}),
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("savings_goals")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("user_id", userId);
    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("savings_goals").insert({
      user_id: userId,
      ...payload,
    });
    if (error) {
      return { error: error.message };
    }
  }
  return { success: true };
}

export async function deleteSavingsGoal(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }
  const { error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { success: true };
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
 * Saves every target at once.
 *
 * Drift is only reported when the targets cover the whole portfolio, so the
 * UI edits them as a set and this writes them as one.
 */
export async function saveWalletTargets(
  targets: { wallet: WalletId; targetWeight: number }[],
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = walletTargetsSchema.safeParse({ targets });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "errors.invalidInput",
    };
  }

  const total = parsed.data.targets.reduce(
    (sum, row) => sum + row.targetWeight,
    0,
  );

  // Anything else would make every wallet look permanently off-target.
  if (parsed.data.targets.length > 0 && Math.abs(total - 1) > 0.005) {
    return { error: "errors.targetsMustTotal100" };
  }

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

  const skipError = await skipWhatTemplatesWrote(userId, parsed.data.ids);
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
      // The phone's mutations have no reader's language to hand, so a
      // message with a date in it is composed in the default one.
      error: translator(DEFAULT_LOCALE)("actions.closeTooEarly", {
        date: formatLongDate(observeOn, DEFAULT_LOCALE),
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

/** Whether an error means migration 023 has not run. */
function fulfilmentSchemaMissing(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

const FULFILMENT_SETUP_MESSAGE = "actions.fulfilmentSetup";

/** Yes: that movement is the occurrence this template called for. */
export async function fulfilOccurrence(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "errors.notAuthenticated" };
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
    if (fulfilmentSchemaMissing(error)) {
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

  return { success: true, message: "actions.counted" };
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
    if (fulfilmentSchemaMissing(error)) {
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

  const { error } = await supabase
    .from("recurring_fulfilments")
    .delete()
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn);

  if (error) {
    if (fulfilmentSchemaMissing(error)) {
      return { error: FULFILMENT_SETUP_MESSAGE };
    }
    return { error: error.message };
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
      await supabase
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

  await supabase
    .from("bank_feed_items")
    .update({ status: "imported", transaction_id: transaction.id })
    .eq("id", itemId)
    .eq("user_id", userId);

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
