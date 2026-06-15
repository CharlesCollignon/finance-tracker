"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
import { getRecurringOccurrenceDates } from "@/lib/recurrence";
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

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
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

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
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
    amount: formData.get("amount"),
    recurrence: formData.get("recurrence"),
    dayOfMonth: formData.get("dayOfMonth") || undefined,
    dayOfWeek: formData.get("dayOfWeek") || undefined,
    active: formData.get("active") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const base = {
    category_id: parsed.data.categoryId,
    amount: parsed.data.amount,
    active: parsed.data.active ?? true,
  };

  if (parsed.data.id) {
    const updatePayload: RecurringTemplateUpdate =
      parsed.data.recurrence === "monthly"
        ? {
            ...base,
            recurrence: "monthly",
            day_of_month: parsed.data.dayOfMonth,
            day_of_week: null,
          }
        : {
            ...base,
            recurrence: "weekly",
            day_of_month: null,
            day_of_week: parsed.data.dayOfWeek,
          };

    const { error } = await supabase
      .from("recurring_templates")
      .update(updatePayload)
      .eq("id", parsed.data.id)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }
  } else {
    const insertPayload: RecurringTemplateInsert =
      parsed.data.recurrence === "monthly"
        ? {
            user_id: user.id,
            ...base,
            recurrence: "monthly",
            day_of_month: parsed.data.dayOfMonth,
            day_of_week: null,
          }
        : {
            user_id: user.id,
            ...base,
            recurrence: "weekly",
            day_of_month: null,
            day_of_week: parsed.data.dayOfWeek,
          };

    const { error } = await supabase
      .from("recurring_templates")
      .insert(insertPayload);

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath("/recurring");
  revalidatePath("/transactions");
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
  const { error } = await supabase
    .from("recurring_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/recurring");
  revalidatePath("/transactions");
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

  revalidatePath("/recurring");
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

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        category_id: template.category_id,
        recurring_template_id: template.id,
        occurred_on: occurredOn,
        amount: template.amount,
        note: "Recurring",
      });

      if (!error) {
        created += 1;
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true, created };
}
