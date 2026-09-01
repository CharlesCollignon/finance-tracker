"use server";

import { z } from "zod";

import { revalidateRecurringDependents } from "@/lib/revalidate-paths";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/supabase/env";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { getMonthBounds } from "@finance/core/constants";
import { resolveRecurringAmount } from "@finance/core/recurring-shares";
import { quoteSource } from "@/lib/quote-source";
import {
  buildApplyRecurringPlan,
  recurringOccurrenceKey,
  type ApplyRecurringPlan,
} from "@finance/core/apply-recurring";
import {
  removeInvestmentPositionForRecurring,
  syncInvestmentPositionFromRecurring,
} from "@/lib/investment-recurring-sync";
import {
  BITCOIN_INSTRUMENT,
  isCryptoCategoryName,
} from "@finance/core/crypto-holdings";
import type {
  Database,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";
import {
  applyRecurringSchema,
  authSchema,
  importTransactionsSchema,
  parseUuid,
  quickTransactionSchema,
  recurringTemplateSchema,
  transactionSchema,
  updateTransactionSchema,
} from "@finance/core/validations/finance";

type ActionResult = { error?: string; success?: boolean; message?: string };

async function loadApplyRecurringData(
  userId: string,
  year: number,
  month: number,
) {
  const supabase = await createClient();
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
    supabase,
    templates: (templates ?? []) as RecurringTemplateWithCategory[],
    existingByKey,
    skippedKeys,
  };
}

async function getUser() {
  const user = await getAuthUser();

  if (!user) {
    return null;
  }

  return user;
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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
      message: "Check your email to confirm your account, then sign in.",
    };
  }

  if (data.user) {
    await seedCategoriesSafely(data.user.id);
  }

  return { success: true };
}

async function seedCategoriesSafely(userId: string): Promise<void> {
  try {
    await seedDefaultCategories(userId);
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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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

export async function createTransaction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = transactionSchema.safeParse({
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    occurredOn: formData.get("occurredOn"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tagIds = formData
    .getAll("tagIds")
    .filter((value): value is string => typeof value === "string");

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
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

  if (created && tagIds.length > 0) {
    const { error: tagError } = await supabase.from("transaction_tags").insert(
      tagIds.map((tagId) => ({
        transaction_id: created.id,
        tag_id: tagId,
      })),
    );
    if (tagError) {
      return { error: tagError.message };
    }
  }

  revalidateRecurringDependents();
  return { success: true };
}

export interface QuickTransactionInput {
  categoryId: string;
  amount: string | number;
  occurredOn: string;
  note?: string;
  tagIds?: string[];
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
): Promise<{ error?: string; id?: string }> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = quickTransactionSchema.safeParse({
    categoryId: input.categoryId,
    amount: input.amount,
    occurredOn: input.occurredOn,
    note: input.note?.trim() || undefined,
    tagIds: input.tagIds ?? [],
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
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

  const tagIds = parsed.data.tagIds ?? [];
  if (created && tagIds.length > 0) {
    const { error: tagError } = await supabase.from("transaction_tags").insert(
      tagIds.map((tagId) => ({ transaction_id: created.id, tag_id: tagId })),
    );
    if (tagError) {
      return { error: tagError.message };
    }
  }

  revalidateRecurringDependents();
  return { id: created?.id };
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
    return { error: "Not authenticated" };
  }

  const parsed = importTransactionsSchema.safeParse({ rows });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid import" };
  }

  const supabase = await createClient();

  // Every row must belong to one of the user's own categories; RLS covers the
  // insert, but checking here turns a database error into a clear message.
  const categoryIds = [...new Set(parsed.data.rows.map((row) => row.categoryId))];
  const { data: owned, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", user.id)
    .in("id", categoryIds);

  if (categoryError) {
    return { error: categoryError.message };
  }

  if ((owned?.length ?? 0) !== categoryIds.length) {
    return { error: "One of the categories no longer exists" };
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

  revalidateRecurringDependents();
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
    return { error: "Not authenticated" };
  }

  const range = z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse({ from, to });

  if (!range.success) {
    return { error: "Invalid date range" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_on, amount, note")
    .eq("user_id", user.id)
    .gte("occurred_on", range.data.from)
    .lte("occurred_on", range.data.to);

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

export async function updateTransaction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = updateTransactionSchema.safeParse({
    id: formData.get("id"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    occurredOn: formData.get("occurredOn"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tagIds = formData
    .getAll("tagIds")
    .filter((value): value is string => typeof value === "string");

  const supabase = await createClient();
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

  await supabase
    .from("transaction_tags")
    .delete()
    .eq("transaction_id", parsed.data.id);

  if (tagIds.length > 0) {
    const { error: tagError } = await supabase.from("transaction_tags").insert(
      tagIds.map((tagId) => ({
        transaction_id: parsed.data.id,
        tag_id: tagId,
      })),
    );
    if (tagError) {
      return { error: tagError.message };
    }
  }

  revalidateRecurringDependents();
  return { success: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!parseUuid(id)) {
    return { error: "Invalid transaction" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateRecurringDependents();
  return { success: true };
}

export async function upsertRecurringTemplate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
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

  if (data.id) {
    const updatePayload: RecurringTemplateUpdate = {
      ...base,
      ...buildSchedulePayload(),
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
      ...buildSchedulePayload(),
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
    await syncInvestmentPositionFromRecurring(supabase, user.id, templateId);
  }

  revalidateRecurringDependents();
  return { success: true };
}

export async function deleteRecurringTemplate(
  id: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!parseUuid(id)) {
    return { error: "Invalid recurring template" };
  }

  const supabase = await createClient();
  await removeInvestmentPositionForRecurring(supabase, user.id, id);

  const { error } = await supabase
    .from("recurring_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateRecurringDependents();
  return { success: true };
}

export async function toggleRecurringActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
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

  revalidateRecurringDependents();
  return { success: true };
}

export async function previewApplyRecurringForMonth(
  year: number,
  month: number,
): Promise<ActionResult & { plan?: ApplyRecurringPlan }> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = applyRecurringSchema.safeParse({ year, month });
  if (!parsed.success) {
    return { error: "Invalid month" };
  }

  try {
    const { templates, existingByKey, skippedKeys } =
      await loadApplyRecurringData(user.id, year, month);
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
   * Occurrence keys to apply. Omitted means the whole plan; supplying it lets
   * the caller deselect individual rows before confirming.
   */
  selectedKeys?: string[],
): Promise<ActionResult & { created?: number; updated?: number }> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = applyRecurringSchema.safeParse({ year, month });
  if (!parsed.success) {
    return { error: "Invalid month" };
  }

  try {
    const { supabase, templates, existingByKey, skippedKeys } =
      await loadApplyRecurringData(user.id, year, month);
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

    const selected = selectedKeys ? new Set(selectedKeys) : null;
    const isSelected = (templateId: string, occurredOn: string) =>
      !selected || selected.has(recurringOccurrenceKey(templateId, occurredOn));

    let created = 0;
    let updated = 0;
    const failures: string[] = [];

    for (const item of plan.toCreate) {
      if (!isSelected(item.templateId, item.occurredOn)) {
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
        user_id: user.id,
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
          .eq("user_id", user.id);
      }
    }

    if (includeUpdates) {
      for (const item of plan.toUpdate) {
        if (!isSelected(item.templateId, item.occurredOn)) {
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
          .eq("user_id", user.id);

        if (error) {
          failures.push(error.message);
          continue;
        }

        updated += 1;
      }
    }

    revalidateRecurringDependents();

    if (failures.length > 0) {
      return {
        error: `Applied ${created} and updated ${updated} entries, but ${failures.length} failed: ${failures[0]}`,
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

/** Skip one occurrence: delete applied tx (if any) and block re-apply. */
export async function skipRecurringOccurrence(
  templateId: string,
  occurredOn: string,
  transactionId?: string | null,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (
    !/^[0-9a-f-]{36}$/i.test(templateId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)
  ) {
    return { error: "Invalid occurrence" };
  }

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("recurring_templates")
    .select("id")
    .eq("id", templateId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!template) {
    return { error: "Recurring template not found" };
  }

  if (transactionId) {
    const { error: deleteError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .eq("recurring_template_id", templateId);

    if (deleteError) {
      return { error: deleteError.message };
    }
  } else {
    await supabase
      .from("transactions")
      .delete()
      .eq("user_id", user.id)
      .eq("recurring_template_id", templateId)
      .eq("occurred_on", occurredOn);
  }

  const { error: skipError } = await supabase.from("recurring_skips").upsert(
    {
      user_id: user.id,
      template_id: templateId,
      occurred_on: occurredOn,
    },
    { onConflict: "user_id,template_id,occurred_on" },
  );

  if (skipError) {
    return { error: skipError.message };
  }

  revalidateRecurringDependents();
  return { success: true, message: "Skipped for this date" };
}

export async function unskipRecurringOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
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

  revalidateRecurringDependents();
  return { success: true, message: "Skip removed" };
}
