"use server";

import { revalidateApp } from "@/lib/revalidate-paths";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import {
  deleteInvestmentPosition,
  upsertInvestmentPosition,
} from "@/lib/queries/investments";
import { displayNameForRecurringTemplate } from "@finance/core/investment-positions";
import { investmentPositionSchema } from "@finance/core/validations/investments";
import {
  BITCOIN_INSTRUMENT,
  isCryptoWallet,
} from "@finance/core/crypto-holdings";

import type { ActionResult, FormState } from "@finance/core/action-result";
import * as plans from "@finance/data/wallet-plans";
import { asUser } from "@/lib/actions/as-user";

async function getUser() {
  return getAuthUser();
}

export async function saveInvestmentPosition(
  _prev: FormState,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
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
    // Omitted until now, which meant `optionalCharge` saw `undefined`, turned
    // it into null, and every save from the web wiped a charge only the phone
    // could write. The form has always submitted the field.
    ongoingCharge: formData.get("ongoingCharge") ?? "",
    instrumentSymbol: formData.get("instrumentSymbol") ?? "",
    instrumentName: formData.get("instrumentName") ?? "",
    isin: formData.get("isin") ?? "",
    valuePinned: formData.get("valuePinned") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
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
      return { error: "actions.recurringNotFound" };
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
      isin: parsed.data.isin,
      valuePinned: parsed.data.valuePinned,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "actions.couldNotSavePosition",
    };
  }

  revalidateApp();
  return { success: true };
}

export async function removeInvestmentPosition(
  positionId: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  try {
    await deleteInvestmentPosition(user.id, positionId);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "actions.couldNotRemovePosition",
    };
  }

  revalidateApp();
  return { success: true };
}

/** One wallet's intent, a field at a time — `@finance/data/wallet-plans`. */
export async function saveWalletPlan(
  input: plans.WalletPlanChange,
): Promise<ActionResult> {
  return asUser((db, userId) => plans.saveWalletPlan(db, userId, input));
}

/** Every target at once, across the savings accounts and the wallets. */
export async function saveAccountTargets(
  targets: { accountId: string; targetWeight: number }[],
): Promise<ActionResult> {
  return asUser((db, userId) => plans.saveAccountTargets(db, userId, targets));
}

/** Every target off; the rest of each wallet's plan stays. */
export async function clearAccountTargets(): Promise<ActionResult> {
  return asUser((db, userId) => plans.clearAccountTargets(db, userId));
}
