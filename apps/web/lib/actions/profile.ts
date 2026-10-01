"use server";

import { revalidateApp } from "@/lib/revalidate-paths";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { disconnectUserBank } from "@/lib/bank/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAllUserData } from "@finance/data/account";
import {
  deleteConfirmSchema,
  profileSchema,
} from "@finance/core/validations/profile";

type ActionResult = { error?: string; success?: boolean; message?: string };

async function getUser() {
  return getAuthUser();
}

export async function updateProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.fullName },
  });

  if (error) {
    return { error: error.message };
  }

  revalidateApp();
  return { success: true, message: "actions.profileUpdated" };
}

export async function deleteAllData(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = deleteConfirmSchema.safeParse({
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const supabase = await createClient();

  try {
    await deleteAllUserData(supabase, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "actions.deleteFailed";
    return { error: message };
  }

  revalidateApp();
  return {
    success: true,
    message: "actions.allDataDeleted",
  };
}

export async function deleteAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = deleteConfirmSchema.safeParse({
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
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
    // First, while the key still opens: revoked at open-banking.io so the
    // delegated access dies with the account rather than outliving it there.
    await disconnectUserBank(user.id, { deleteImported: false });
    await deleteAllUserData(supabase, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "actions.deleteFailed";
    return { error: message };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return { error: error.message };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
