"use server";

import { revalidateRecurringDependents } from "@/lib/revalidate-paths";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { getRecurringOccurrenceDates } from "@/lib/recurrence";
import { resolveRecurringAmount } from "@/lib/recurring-shares";
import {
  removeInvestmentPositionForRecurring,
  syncInvestmentPositionFromRecurring,
} from "@/lib/investment-recurring-sync";
import type { Database } from "@/lib/types/database";
import {
  applyRecurringSchema,
  authSchema,
  recurringTemplateSchema,
  transactionSchema,
} from "@/lib/validations/finance";

type ActionResult = { error?: string; success?: boolean; message?: string };

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
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
    await seedDefaultCategories(data.user.id);
  }

  return { success: true };
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
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
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

  revalidateRecurringDependents();
  return { success: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
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
    pricingType:
      formData.get("pricingType") === "shares" ? "shares" : "fixed",
    shareCount: formData.get("shareCount") || undefined,
    instrumentSymbol: formData.get("instrumentSymbol") || undefined,
    instrumentName: formData.get("instrumentName") || undefined,
    description: formData.get("description") || undefined,
    recurrence: formData.get("recurrence"),
    dayOfMonth: formData.get("dayOfMonth") || undefined,
    dayOfWeek: formData.get("dayOfWeek") || undefined,
    monthOfYear: formData.get("monthOfYear") || undefined,
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
      const resolved = await resolveRecurringAmount({
        pricing_type: "shares",
        amount: 0,
        share_count: data.shareCount ?? null,
        instrument_symbol: data.instrumentSymbol ?? null,
        instrument_name: data.instrumentName ?? null,
        description: data.description ?? null,
        last_quote_price: null,
      });
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
      instrument_symbol: null,
      instrument_name: null,
      last_quote_price: null,
      last_quote_at: null,
    };
  }

  const supabase = await createClient();
  const base = {
    category_id: data.categoryId,
    amount,
    active: data.active ?? true,
    description: data.description?.trim() || null,
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
    await syncInvestmentPositionFromRecurring(
      supabase,
      user.id,
      templateId,
    );
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

export async function applyRecurringForMonth(
  year: number,
  month: number,
): Promise<ActionResult & { created?: number }> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = applyRecurringSchema.safeParse({ year, month });
  if (!parsed.success) {
    return { error: "Invalid month" };
  }

  const supabase = await createClient();

  const { data: templates, error: tplError } = await supabase
    .from("recurring_templates")
    .select("*, categories(type)")
    .eq("user_id", user.id)
    .eq("active", true);

  if (tplError) {
    return { error: tplError.message };
  }

  let created = 0;

  for (const template of templates ?? []) {
    const occurrenceDates = getRecurringOccurrenceDates(
      {
        recurrence: template.recurrence ?? "monthly",
        day_of_month: template.day_of_month,
        day_of_week: template.day_of_week,
        month_of_year: template.month_of_year,
      },
      year,
      month,
    );

    for (const occurredOn of occurrenceDates) {
      const { data: existing } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("recurring_template_id", template.id)
        .eq("occurred_on", occurredOn)
        .maybeSingle();

      if (existing) {
        continue;
      }

      let amount = Number(template.amount);
      let note = template.description?.trim() || null;
      let quoteUpdate: {
        amount: number;
        last_quote_price: number;
        last_quote_at: string;
      } | null = null;

      try {
        const resolved = await resolveRecurringAmount({
          pricing_type: template.pricing_type ?? "fixed",
          amount: Number(template.amount),
          share_count: template.share_count,
          instrument_symbol: template.instrument_symbol,
          instrument_name: template.instrument_name,
          description: template.description,
          last_quote_price: template.last_quote_price,
        });
        amount = resolved.amount;
        note = resolved.note;
        quoteUpdate = resolved.quoteUpdate;
      } catch {
        continue;
      }

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        category_id: template.category_id,
        recurring_template_id: template.id,
        occurred_on: occurredOn,
        amount,
        note,
      });

      if (!error) {
        created += 1;

        if (quoteUpdate) {
          await supabase
            .from("recurring_templates")
            .update(quoteUpdate)
            .eq("id", template.id)
            .eq("user_id", user.id);
        }
      }
    }
  }

  revalidateRecurringDependents();
  return { success: true, created };
}
