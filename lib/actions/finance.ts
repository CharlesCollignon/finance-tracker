"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultCategories } from "@/lib/queries/categories";
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
    dayOfMonth: formData.get("dayOfMonth"),
    active: formData.get("active") === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const payload = {
    user_id: user.id,
    category_id: parsed.data.categoryId,
    amount: parsed.data.amount,
    day_of_month: parsed.data.dayOfMonth,
    active: parsed.data.active ?? true,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("recurring_templates")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("recurring_templates")
      .insert(payload);

    if (error) {
      return { error: error.message };
    }
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

  const lastDay = new Date(year, month, 0).getDate();
  let created = 0;

  for (const template of templates ?? []) {
    const day = Math.min(template.day_of_month, lastDay);
    const occurredOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("recurring_template_id", template.id)
      .gte("occurred_on", `${year}-${String(month).padStart(2, "0")}-01`)
      .lte("occurred_on", `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`)
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

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true, created };
}
