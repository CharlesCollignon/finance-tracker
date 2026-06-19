"use server";

import { revalidateRecurringDependents } from "@/lib/revalidate-paths";
import { createClient } from "@/lib/supabase/server";
import {
  deleteInvestmentPosition,
  upsertInvestmentPosition,
} from "@/lib/queries/investments";
import { displayNameForRecurringTemplate } from "@/lib/investment-positions";
import { investmentPositionSchema } from "@/lib/validations/investments";

type ActionResult = { error?: string; success?: boolean };

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

export async function saveInvestmentPosition(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const positionId = formData.get("positionId");
  const parsed = investmentPositionSchema.safeParse({
    positionId: positionId ? String(positionId) : undefined,
    wallet: formData.get("wallet"),
    sourceType: formData.get("sourceType"),
    recurringTemplateId: formData.get("recurringTemplateId") ?? "",
    name: formData.get("name") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    initialBalance: formData.get("initialBalance"),
    currentValue: formData.get("currentValue") ?? "",
    shareCount: formData.get("shareCount") ?? "",
    instrumentSymbol: formData.get("instrumentSymbol") ?? "",
    instrumentName: formData.get("instrumentName") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let name = parsed.data.name;
  let categoryId = parsed.data.categoryId;
  const recurringTemplateId = parsed.data.recurringTemplateId;

  if (recurringTemplateId) {
    const supabase = await createClient();
    const { data: template, error } = await supabase
      .from("recurring_templates")
      .select("id, category_id, description, instrument_name, categories(name, type, icon, counts_toward_summary)")
      .eq("id", recurringTemplateId)
      .eq("user_id", user.id)
      .single();

    if (error || !template) {
      return { error: "Recurring item not found" };
    }

    name = displayNameForRecurringTemplate(
      template as Parameters<typeof displayNameForRecurringTemplate>[0],
    );
    categoryId = template.category_id;
  }

  try {
    await upsertInvestmentPosition(user.id, {
      positionId: parsed.data.positionId,
      wallet: parsed.data.wallet,
      recurringTemplateId,
      name,
      categoryId,
      initialBalance: parsed.data.initialBalance,
      currentValue: parsed.data.currentValue,
      shareCount: parsed.data.shareCount,
      instrumentSymbol: parsed.data.instrumentSymbol,
      instrumentName: parsed.data.instrumentName,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save this position.",
    };
  }

  revalidateRecurringDependents();
  return { success: true };
}

export async function removeInvestmentPosition(
  positionId: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    await deleteInvestmentPosition(user.id, positionId);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not remove this position.",
    };
  }

  revalidateRecurringDependents();
  return { success: true };
}
