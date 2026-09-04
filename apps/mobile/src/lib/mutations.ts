import {
  applyRecurringSchema,
  authSchema,
  categorySchema,
  deleteTransactionsSchema,
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
  walletTransferSchema,
} from "@finance/core/validations/phase4";
import { getMonthBounds, todayIsoLocal } from "@finance/core/constants";
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
  previewMonthClose,
} from "@/lib/queries";
import {
  buildApplyRecurringPlan,
  type ApplyRecurringPlan,
} from "@finance/core/apply-recurring";
import { recurringOccurrenceKey } from "@finance/core/apply-recurring";
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
} from "@finance/core/types/database";

import { quoteSource } from "@/lib/quote-source";
import { supabase } from "@/lib/supabase";

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
    return { error: "Not authenticated" };
  }

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
    return { error: "Not authenticated" };
  }

  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
    return { error: "Not authenticated" };
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
 * Removes one generated occurrence and records a skip so Apply will not
 * recreate it. The recurring rule itself stays active. Ported from the web
 * skipRecurringOccurrence action.
 */
export async function skipRecurringOccurrence(
  templateId: string,
  occurredOn: string,
  transactionId?: string | null,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  if (
    !/^[0-9a-f-]{36}$/i.test(templateId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)
  ) {
    return { error: "Invalid occurrence" };
  }

  const { data: template } = await supabase
    .from("recurring_templates")
    .select("id")
    .eq("id", templateId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!template) {
    return { error: "Recurring template not found" };
  }

  if (transactionId) {
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", userId)
      .eq("recurring_template_id", templateId);

    if (deleteError) {
      return { error: deleteError.message };
    }
  } else {
    await supabase
      .from("transactions")
      .delete()
      .eq("user_id", userId)
      .eq("recurring_template_id", templateId)
      .eq("occurred_on", occurredOn);
  }

  const { error: skipError } = await supabase.from("recurring_skips").upsert(
    {
      user_id: userId,
      template_id: templateId,
      occurred_on: occurredOn,
    },
    { onConflict: "user_id,template_id,occurred_on" },
  );

  if (skipError) {
    return { error: skipError.message };
  }

  return { success: true, message: "Skipped for this date" };
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
    return { error: "Not authenticated" };
  }

  if (!Number.isFinite(input.initialBalance) || input.initialBalance < 0) {
    return { error: "Enter a valid starting balance" };
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
    return { error: "Not authenticated" };
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
    return "This category is used by transactions or recurring items. Archive it instead.";
  }
  if (message.includes("duplicate key")) {
    return "A category with this name and type already exists.";
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
    return { error: "Not authenticated" };
  }

  const parsed = categorySchema.safeParse({
    id: input.id,
    name: input.name,
    type: input.type,
    icon: input.icon ?? undefined,
    countsTowardSummary: input.countsTowardSummary ?? true,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
    return { error: "Not authenticated" };
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
    return { error: "Not authenticated" };
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
 * Lifts a skip so Apply will recreate the occurrence. Without this, skipping
 * was a one-way door — the row simply vanished with no way back.
 */
export async function unskipRecurringOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
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
  return { success: true };
}

/** Replaces a transaction's tags wholesale, mirroring the web action. */
export async function setTransactionTags(
  transactionId: string,
  tagIds: string[],
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const { data: tx } = await supabase
    .from("transactions")
    .select("id")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!tx) {
    return { error: "Transaction not found" };
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
    return { error: "Not authenticated" };
  }

  const parsed = recurringTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
        error:
          error instanceof Error
            ? error.message
            : "Could not price this instrument.",
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
      return { error: error?.message ?? "Could not save recurring item" };
    }
    templateId = inserted.id;
  }

  if (templateId) {
    await syncInvestmentPositionFromRecurring(userId, templateId);
  }

  return { success: true };
}

export async function deleteRecurringTemplate(
  id: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
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
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("recurring_templates")
    .update({ active })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
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

  const skippedKeys = new Set(
    (skips ?? []).map((row) => `${row.template_id}:${row.occurred_on}`),
  );

  return {
    templates: (templates ?? []) as RecurringTemplateWithCategory[],
    existingByKey,
    skippedKeys,
  };
}

export async function previewApplyRecurringForMonth(
  year: number,
  month: number,
): Promise<ActionResult & { plan?: ApplyRecurringPlan }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = applyRecurringSchema.safeParse({ year, month });
  if (!parsed.success) {
    return { error: "Invalid month" };
  }

  // With a bank feeding the ledger, templates only forecast; an empty plan is
  // what makes every apply affordance stand down at once. See the web twin.
  if (await hasBankFeed(userId)) {
    return {
      success: true,
      plan: { toCreate: [], toUpdate: [], toReprice: [] },
    };
  }

  try {
    const { templates, existingByKey, skippedKeys } =
      await loadApplyRecurringData(userId, year, month);
    const plan = await buildApplyRecurringPlan(
      templates,
      existingByKey,
      year,
      month,
      { quotes: quoteSource, skippedKeys, today: todayIsoLocal() },
    );
    return { success: true, plan };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not preview recurring changes.",
    };
  }
}

export async function applyRecurringForMonth(
  year: number,
  month: number,
  includeUpdates = false,
  /**
   * Occurrence keys to apply. Omitted means everything in the plan; supplying
   * it lets the caller deselect individual rows before confirming.
   */
  selectedKeys?: Set<string>,
): Promise<ActionResult & { created?: number; updated?: number }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = applyRecurringSchema.safeParse({ year, month });
  if (!parsed.success) {
    return { error: "Invalid month" };
  }

  // Refused rather than merely hidden, so a stale screen cannot reintroduce
  // the second writer this model exists to avoid.
  if (await hasBankFeed(userId)) {
    return {
      error:
        "Your bank fills this in now — recurring items are a forecast rather than something to apply.",
    };
  }

  try {
    const { templates, existingByKey, skippedKeys } =
      await loadApplyRecurringData(userId, year, month);
    const plan = await buildApplyRecurringPlan(
      templates,
      existingByKey,
      year,
      month,
      { quotes: quoteSource, skippedKeys, today: todayIsoLocal() },
    );
    const templatesById = new Map(
      templates.map((template) => [template.id, template]),
    );

    let created = 0;
    let updated = 0;
    const failures: string[] = [];

    for (const item of plan.toCreate) {
      if (
        selectedKeys &&
        !selectedKeys.has(
          recurringOccurrenceKey(item.templateId, item.occurredOn),
        )
      ) {
        continue;
      }
      const template = templatesById.get(item.templateId);
      let quoteUpdate: {
        amount: number;
        last_quote_price: number;
        last_quote_at: string;
      } | null = null;

      if (template) {
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
          quoteUpdate = null;
        }
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
        failures.push(error.message);
        continue;
      }

      created += 1;
      if (quoteUpdate) {
        await supabase
          .from("recurring_templates")
          .update(quoteUpdate)
          .eq("id", item.templateId)
          .eq("user_id", userId);
      }
    }

    if (includeUpdates) {
      for (const item of plan.toUpdate) {
        if (
          selectedKeys &&
          !selectedKeys.has(
            recurringOccurrenceKey(item.templateId, item.occurredOn),
          )
        ) {
          continue;
        }
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
          continue;
        }
        updated += 1;
      }
    }

    // Not offered and not selectable: a market move is nobody's decision.
    // The server's daily run does this too; here it is free, because the
    // write is already open.
    for (const item of plan.toReprice) {
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

    if (failures.length > 0) {
      return {
        error: `Applied ${created} and updated ${updated}, but ${failures.length} failed: ${failures[0]}`,
        created,
        updated,
      };
    }

    return { success: true, created, updated };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not apply recurring entries.",
    };
  }
}

export async function updateProfile(fullName: string): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({ fullName });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.fullName },
  });

  if (error) {
    return { error: error.message };
  }
  return { success: true, message: "Profile updated" };
}

export async function deleteAllUserData(
  confirmation: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = deleteConfirmSchema.safeParse({ confirmation });
  if (!parsed.success) {
    return { error: "Type DELETE to confirm" };
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

  return { success: true, message: "All data deleted" };
}

export async function upsertBudget(input: {
  id?: string;
  categoryId?: string | null;
  amount: number;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
    return { error: "Not authenticated" };
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

export async function upsertWalletTransfer(input: {
  toWallet: "pea" | "cto" | "crypto";
  amount: number;
  occurredOn: string;
  note?: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = walletTransferSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("wallet_transfers").insert({
    user_id: userId,
    to_wallet: parsed.data.toWallet,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    note: parsed.data.note ?? null,
  });
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function deleteWalletTransfer(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }
  const { error } = await supabase
    .from("wallet_transfers")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function upsertTag(name: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }
  const parsed = tagSchema.safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { error } = await supabase.from("tags").insert({
    user_id: userId,
    name: parsed.data.name,
  });
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}

export async function upsertSavingsGoal(input: {
  id?: string;
  name: string;
  targetAmount: number;
  targetDate?: string;
  categoryId?: string | null;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = savingsGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const payload = {
    name: parsed.data.name,
    target_amount: parsed.data.targetAmount,
    target_date: parsed.data.targetDate || null,
    category_id: parsed.data.categoryId ?? null,
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
    return { error: "Not authenticated" };
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
  wallet: "pea" | "cto" | "crypto";
  targetWeight?: string | number;
  openedOn?: string;
  contributionCeiling?: string | number;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = walletPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
  targets: { wallet: "pea" | "cto" | "crypto"; targetWeight: number }[],
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = walletTargetsSchema.safeParse({ targets });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid targets" };
  }

  const total = parsed.data.targets.reduce(
    (sum, row) => sum + row.targetWeight,
    0,
  );

  // Anything else would make every wallet look permanently off-target.
  if (parsed.data.targets.length > 0 && Math.abs(total - 1) > 0.005) {
    return { error: "Targets must add up to 100%" };
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
    return { error: "Not authenticated" };
  }

  const parsed = importTransactionsSchema.safeParse({ rows });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid import" };
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
    return { error: "Not authenticated" };
  }

  const parsed = deleteTransactionsSchema.safeParse({ ids });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid selection" };
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

/* ------------------------------------------------------------ closing a month */

export async function previewMonthCloseFor(
  year: number,
  month: number,
  closingBalance: number,
): Promise<ActionResult & { result?: MonthCloseResult }> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid close" };
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
        error instanceof Error ? error.message : "Could not work that out.",
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
    return { error: "Not authenticated" };
  }

  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid close" };
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
      error: `This month can be closed from ${observeOn}, once the last of its spending has landed.`,
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
        error instanceof Error ? error.message : "Could not close the month.",
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
    return { error: "Not authenticated" };
  }

  const parsed = monthCloseSchema.safeParse({ year, month, closingBalance: 0 });
  if (!parsed.success) {
    return { error: "Invalid month" };
  }

  const { error } = await supabase
    .from("month_closes")
    .delete()
    .eq("user_id", userId)
    .eq("month", monthColumnValue(parsed.data.year, parsed.data.month));

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Close removed" };
}

export async function updateUnrecordedCap(
  cap: number | null,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = unrecordedCapSchema.safeParse({ cap });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid cap" };
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
    message: parsed.data.cap === null ? "Cap removed" : "Cap set",
  };
}

export async function updateCloseDay(closeDay: number): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = closeDaySchema.safeParse({ closeDay });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid day" };
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

  return { success: true, message: "Reading day updated" };
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

const FULFILMENT_SETUP_MESSAGE =
  "Confirming charges needs migration 023 — run it and this will work.";

/** Yes: that movement is the occurrence this template called for. */
export async function fulfilOccurrence(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
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
        error: "That movement is already accounted for by another charge",
      };
    }
    return { error: error.message };
  }

  return { success: true, message: "Counted — it is no longer forecast" };
}

/** No: that is not what this charge was. */
export async function refuseFulfilment(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
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
  return { success: true, message: "Won't suggest that pairing again" };
}

/** Take a confirmation back, and put the occurrence back in the forecast. */
export async function undoFulfilment(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
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

  return { success: true, message: "Back in the forecast" };
}
