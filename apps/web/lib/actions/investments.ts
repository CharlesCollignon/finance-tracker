"use server";

import { revalidateApp } from "@/lib/revalidate-paths";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import {
  deleteInvestmentPosition,
  upsertInvestmentPosition,
} from "@/lib/queries/investments";
import { displayNameForRecurringTemplate } from "@finance/core/investment-positions";
import { z } from "zod";
import {
  ACCOUNT_IDS,
  isSavingsAccountId,
  type AccountId,
} from "@finance/core/allocation";
import type { InvestmentWalletId } from "@finance/core/investments";
import type { SavingsAccountKind } from "@finance/core/types/database";
import {
  investmentPositionSchema,
  walletPlanSchema,
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

/**
 * Saves one wallet's plan — its target share of the portfolio, when the
 * wrapper was opened, and any non-standard contribution ceiling.
 *
 * Upserted per wallet rather than as a set, so setting a PEA's opening date
 * does not require the user to have decided on target weights first.
 */
/**
 * One wallet's intent, changed a field at a time.
 *
 * Only the fields the caller actually sent are written. That is not a
 * micro-optimisation: `walletPlanSchema` turns an absent field into `null`,
 * and the upsert used to write every column — so saving a PEA's opening date
 * silently cleared its target weight, and the drift figure with it. Three
 * editors share this row and each of them touches one field.
 *
 * `wallet` is read from the raw input rather than the parsed output because
 * the parsed output cannot say whether a null was sent or merely absent.
 */
export async function saveWalletPlan(input: {
  wallet: string;
  targetWeight?: string | number;
  openedOn?: string;
  contributionCeiling?: string | number;
  wrapperFee?: string | number;
}): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = walletPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errors.invalidInput" };
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    wallet: parsed.data.wallet,
    updated_at: new Date().toISOString(),
  };
  if ("targetWeight" in input) {
    row.target_weight = parsed.data.targetWeight;
  }
  if ("openedOn" in input) {
    row.opened_on = parsed.data.openedOn;
  }
  if ("contributionCeiling" in input) {
    row.contribution_ceiling = parsed.data.contributionCeiling;
  }
  if ("wrapperFee" in input) {
    row.wrapper_fee = parsed.data.wrapperFee;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("wallet_plans")
    .upsert(row as never, { onConflict: "user_id,wallet" });

  if (error) {
    return { error: error.message };
  }

  revalidateApp();
  return { success: true };
}

const accountTargetsInput = z.object({
  targets: z
    .array(
      z.object({
        accountId: z.enum(ACCOUNT_IDS as [AccountId, ...AccountId[]]),
        targetWeight: z.coerce.number().min(0).max(1),
      }),
    )
    .max(ACCOUNT_IDS.length),
});

/** Whether an error means migration 047 (savings targets) has not run. */
function savingsTargetsMissing(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * Saves every target at once, across the savings accounts and the wallets.
 *
 * Drift is only reported when the targets cover everything kept, so the UI
 * edits them as a set and this writes them as one: a wallet's on its plan
 * row, a savings account's on the account itself.
 */
export async function saveAccountTargets(
  targets: { accountId: string; targetWeight: number }[],
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = accountTargetsInput.safeParse({ targets });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const total = parsed.data.targets.reduce(
    (sum, row) => sum + row.targetWeight,
    0,
  );

  // Anything else would make every account look permanently off-target.
  if (parsed.data.targets.length > 0 && Math.abs(total - 1) > 0.005) {
    return { error: "errors.targetsMustTotal100" };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const wallets = parsed.data.targets.filter(
    (row) => !isSavingsAccountId(row.accountId),
  );
  const savings = parsed.data.targets.filter((row) =>
    isSavingsAccountId(row.accountId),
  );

  for (const row of savings) {
    const { error } = await supabase
      .from("savings_accounts")
      .update({ target_weight: row.targetWeight, updated_at: now })
      .eq("user_id", user.id)
      .eq("kind", row.accountId as SavingsAccountKind);
    if (error) {
      return {
        error: savingsTargetsMissing(error)
          ? "placementsWeb.targetsSetup"
          : error.message,
      };
    }
  }

  if (wallets.length > 0) {
    const { error } = await supabase.from("wallet_plans").upsert(
      wallets.map((row) => ({
        user_id: user.id,
        wallet: row.accountId as InvestmentWalletId,
        target_weight: row.targetWeight,
        updated_at: now,
      })),
      { onConflict: "user_id,wallet" },
    );
    if (error) {
      return { error: error.message };
    }
  }

  revalidateApp();
  return { success: true };
}

/**
 * Takes every target off, so the split goes back to showing what is alone.
 * The rest of each wallet's plan (the PEA's opening date, a ceiling, an
 * envelope fee) lives on the same rows and is left as it was.
 */
export async function clearAccountTargets(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("wallet_plans")
    .update({ target_weight: null, updated_at: now })
    .eq("user_id", user.id);
  if (error) {
    return { error: error.message };
  }

  // Before 047 no savings account can hold a target, so there is none to take off.
  const { error: savingsError } = await supabase
    .from("savings_accounts")
    .update({ target_weight: null, updated_at: now })
    .eq("user_id", user.id);
  if (savingsError && !savingsTargetsMissing(savingsError)) {
    return { error: savingsError.message };
  }

  revalidateApp();
  return { success: true };
}
