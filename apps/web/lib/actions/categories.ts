"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { revalidateRecurringDependents } from "@/lib/revalidate-paths";
import { categorySchema } from "@finance/core/validations/finance";

type ActionResult = { error?: string; success?: boolean };

async function getUser() {
  return getAuthUser();
}

function revalidateCategoryDependents(): void {
  revalidatePath("/categories");
  revalidateRecurringDependents();
}

export async function upsertCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    type: formData.get("type"),
    icon: formData.get("icon") || undefined,
    countsTowardSummary: formData.get("countsTowardSummary") !== "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const payload = {
    name: parsed.data.name,
    type: parsed.data.type,
    icon: parsed.data.icon ?? null,
    counts_toward_summary: parsed.data.countsTowardSummary ?? true,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("categories")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("user_id", user.id);

    if (error) {
      return { error: friendlyCategoryError(error.message) };
    }
  } else {
    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      ...payload,
    });

    if (error) {
      return { error: friendlyCategoryError(error.message) };
    }
  }

  revalidateCategoryDependents();
  return { success: true };
}

export async function setCategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ archived })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateCategoryDependents();
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: friendlyCategoryError(error.message) };
  }

  revalidateCategoryDependents();
  return { success: true };
}

function friendlyCategoryError(message: string): string {
  if (message.includes("foreign key")) {
    return "This category is used by transactions or recurring items. Archive it instead.";
  }
  if (message.includes("duplicate key")) {
    return "A category with this name and type already exists.";
  }
  return message;
}
