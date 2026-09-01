"use server";

import { revalidateRecurringDependents } from "@/lib/revalidate-paths";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import {
  deleteInvestmentPosition,
  upsertInvestmentPosition,
} from "@/lib/queries/investments";
import { displayNameForRecurringTemplate } from "@finance/core/investment-positions";
import {
  investmentPositionSchema,
  walletPlanSchema,
  walletTargetsSchema,
} from "@finance/core/validations/investments";
import {
  BITCOIN_INSTRUMENT,
  isCryptoWallet,
} from "@finance/core/crypto-holdings";

type ActionResult = { error?: string; success?: boolean };

async function getUser() {
  return getAuthUser();
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
      .select(
        "id, category_id, description, instrument_name, categories(name, type, icon, counts_toward_summary)",
      )
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
    const instrumentSymbol = isCryptoWallet(parsed.data.wallet)
      ? (parsed.data.instrumentSymbol ?? BITCOIN_INSTRUMENT.symbol)
      : parsed.data.instrumentSymbol;
    const instrumentName = isCryptoWallet(parsed.data.wallet)
      ? (parsed.data.instrumentName ?? BITCOIN_INSTRUMENT.name)
      : parsed.data.instrumentName;

    await upsertInvestmentPosition(user.id, {
      positionId: parsed.data.positionId,
      wallet: parsed.data.wallet,
      recurringTemplateId,
      name,
      categoryId,
      initialBalance: parsed.data.initialBalance,
      currentValue: parsed.data.currentValue,
      shareCount: parsed.data.shareCount,
      instrumentSymbol,
      instrumentName,
      ongoingCharge: parsed.data.ongoingCharge,
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

/**
 * Saves one wallet's plan — its target share of the portfolio, when the
 * wrapper was opened, and any non-standard contribution ceiling.
 *
 * Upserted per wallet rather than as a set, so setting a PEA's opening date
 * does not require the user to have decided on target weights first.
 */
export async function saveWalletPlan(input: {
  wallet: string;
  targetWeight?: string | number;
  openedOn?: string;
  contributionCeiling?: string | number;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = walletPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("wallet_plans").upsert(
    {
      user_id: user.id,
      wallet: parsed.data.wallet,
      target_weight: parsed.data.targetWeight,
      opened_on: parsed.data.openedOn,
      contribution_ceiling: parsed.data.contributionCeiling,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,wallet" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidateRecurringDependents();
  return { success: true };
}

/**
 * Saves every target at once.
 *
 * Drift is only reported when the targets cover the whole portfolio, so the
 * UI edits them as a set and this writes them as one.
 */
export async function saveWalletTargets(
  targets: { wallet: string; targetWeight: number }[],
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const parsed = walletTargetsSchema.safeParse({ targets });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid targets" };
  }

  const total = parsed.data.targets.reduce(
    (sum, row) => sum + row.targetWeight,
    0,
  );

  // Anything else would make every wallet look permanently off-target.
  if (parsed.data.targets.length > 0 && Math.abs(total - 1) > 0.005) {
    return { error: "Targets must add up to 100%" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("wallet_plans").upsert(
    parsed.data.targets.map((row) => ({
      user_id: user.id,
      wallet: row.wallet,
      target_weight: row.targetWeight,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,wallet" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidateRecurringDependents();
  return { success: true };
}
