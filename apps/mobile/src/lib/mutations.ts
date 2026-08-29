import {
  applyRecurringSchema,
  authSchema,
  categorySchema,
  recurringTemplateSchema,
  transactionSchema,
  updateTransactionSchema,
} from "@finance/core/validations/finance";
import {
  profileSchema,
  deleteConfirmSchema,
} from "@finance/core/validations/profile";
import {
  budgetSchema,
  savingsGoalSchema,
  tagSchema,
  walletTransferSchema,
} from "@finance/core/validations/phase4";
import { getMonthBounds } from "@finance/core/constants";
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

  try {
    const { templates, existingByKey, skippedKeys } =
      await loadApplyRecurringData(userId, year, month);
    const plan = await buildApplyRecurringPlan(
      templates,
      existingByKey,
      year,
      month,
      { quotes: quoteSource, skippedKeys },
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

  try {
    const { templates, existingByKey, skippedKeys } =
      await loadApplyRecurringData(userId, year, month);
    const plan = await buildApplyRecurringPlan(
      templates,
      existingByKey,
      year,
      month,
      { quotes: quoteSource, skippedKeys },
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
