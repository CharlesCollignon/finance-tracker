"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { revalidateRecurringDependents } from "@/lib/revalidate-paths";
import {
  budgetSchema,
  savingsGoalSchema,
  tagSchema,
  walletTransferSchema,
} from "@finance/core/validations/phase4";
import { parseUuid } from "@finance/core/validations/finance";

type ActionResult = { error?: string; success?: boolean };

async function requireUserId(): Promise<string | null> {
  const user = await getAuthUser();
  return user?.id ?? null;
}

function revalidatePhase4(): void {
  revalidatePath("/budgets");
  revalidatePath("/investments");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidateRecurringDependents();
}

export async function upsertBudget(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const rawCategory = formData.get("categoryId");
  const parsed = budgetSchema.safeParse({
    id: formData.get("id") || undefined,
    categoryId: rawCategory === "" || rawCategory === null ? null : rawCategory,
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
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

  revalidatePhase4();
  return { success: true };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  if (!parseUuid(id)) {
    return { error: "Invalid budget" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }
  revalidatePhase4();
  return { success: true };
}

export async function upsertWalletTransfer(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = walletTransferSchema.safeParse({
    id: formData.get("id") || undefined,
    toWallet: formData.get("toWallet"),
    amount: formData.get("amount"),
    occurredOn: formData.get("occurredOn"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const payload = {
    to_wallet: parsed.data.toWallet,
    amount: parsed.data.amount,
    occurred_on: parsed.data.occurredOn,
    note: parsed.data.note ?? null,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("wallet_transfers")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("user_id", userId);
    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("wallet_transfers").insert({
      user_id: userId,
      ...payload,
    });
    if (error) {
      return { error: error.message };
    }
  }

  revalidatePhase4();
  return { success: true };
}

export async function deleteWalletTransfer(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  if (!parseUuid(id)) {
    return { error: "Invalid transfer" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("wallet_transfers")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }
  revalidatePhase4();
  return { success: true };
}

export async function upsertTag(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const parsed = tagSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  if (parsed.data.id) {
    const { error } = await supabase
      .from("tags")
      .update({ name: parsed.data.name })
      .eq("id", parsed.data.id)
      .eq("user_id", userId);
    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("tags").insert({
      user_id: userId,
      name: parsed.data.name,
    });
    if (error) {
      return { error: error.message };
    }
  }

  revalidatePhase4();
  return { success: true };
}

export async function setTransactionTags(
  transactionId: string,
  tagIds: string[],
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const supabase = await createClient();
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

  revalidatePhase4();
  return { success: true };
}

export async function upsertSavingsGoal(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const rawCategory = formData.get("categoryId");
  const parsed = savingsGoalSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate") || undefined,
    categoryId: rawCategory === "" || rawCategory === null ? null : rawCategory,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
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

  revalidatePhase4();
  return { success: true };
}

export async function deleteSavingsGoal(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  if (!parseUuid(id)) {
    return { error: "Invalid goal" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }
  revalidatePhase4();
  return { success: true };
}
