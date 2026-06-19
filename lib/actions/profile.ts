"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAllUserData } from "@/lib/queries/account";
import {
  deleteConfirmSchema,
  profileSchema,
} from "@/lib/validations/profile";

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

export async function updateProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.fullName },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true, message: "Profile updated" };
}

export async function deleteAllData(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = deleteConfirmSchema.safeParse({
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  try {
    await deleteAllUserData(user.id, supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return { error: message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/recurring");
  revalidatePath("/calendar");
  revalidatePath("/investments");
  revalidatePath("/profile");
  return {
    success: true,
    message: "All finance data deleted. Default categories will be restored on next visit.",
  };
}

export async function deleteAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = deleteConfirmSchema.safeParse({
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  if (!admin) {
    return {
      error:
        "Account deletion is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
    };
  }

  try {
    await deleteAllUserData(user.id, supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return { error: message };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return { error: error.message };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
