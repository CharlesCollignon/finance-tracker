import type { ActionResult } from "@finance/core/action-result";
import { firstIssue } from "@finance/core/action-result";
import {
  ACCOUNT_IDS,
  isSavingsAccountId,
  type AccountId,
} from "@finance/core/allocation";
import type { InvestmentWalletId } from "@finance/core/investments";
import type { SavingsAccountKind } from "@finance/core/types/database";
import { walletPlanSchema } from "@finance/core/validations/investments";
import { z } from "zod";

import type { Db } from "./client";
import { dbError } from "./errors";

/**
 * What a user means to do with each account: a wallet's plan — its target
 * share, when the wrapper was opened, a ceiling, an envelope fee — and the
 * targets across savings accounts and wallets together. For both apps.
 */

/** Whether an error means migration 047 (savings targets) has not run. */
function savingsTargetsMissing(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/** The fields of one wallet's plan a screen sends, "" clearing one. */
export type WalletPlanChange = Omit<
  z.input<typeof walletPlanSchema>,
  "wallet"
> & { wallet: string };

/**
 * One wallet's intent, changed a field at a time.
 *
 * Only the fields the caller actually sent are written. That is not a
 * micro-optimisation: `walletPlanSchema` turns an absent field into `null`,
 * and writing every column is how saving a PEA's opening date silently
 * cleared its target weight, and the drift figure with it — on the web
 * once, and on the phone until this was shared. Three editors share this
 * row and each of them touches one field.
 *
 * Which fields were sent is read from the raw input, because the parsed
 * output cannot say whether a null was sent or merely absent.
 */
export async function saveWalletPlan(
  db: Db,
  userId: string,
  input: WalletPlanChange,
): Promise<ActionResult> {
  const parsed = walletPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const row: {
    user_id: string;
    wallet: typeof parsed.data.wallet;
    updated_at: string;
    target_weight?: number | null;
    opened_on?: string | null;
    contribution_ceiling?: number | null;
    wrapper_fee?: number | null;
  } = {
    user_id: userId,
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

  const { error } = await db
    .from("wallet_plans")
    .upsert(row, { onConflict: "user_id,wallet" });

  return error ? { error: dbError(error) } : { success: true };
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

/**
 * Saves every target at once, across the savings accounts and the wallets.
 *
 * Drift is only reported when the targets cover everything kept, so the
 * screens edit them as a set and this writes them as one: a wallet's on its
 * plan row, a savings account's on the account itself. They must come to
 * 100% — anything else would make every account look permanently off target.
 */
export async function saveAccountTargets(
  db: Db,
  userId: string,
  targets: readonly { accountId: string; targetWeight: number }[],
): Promise<ActionResult> {
  const parsed = accountTargetsInput.safeParse({ targets });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const total = parsed.data.targets.reduce(
    (sum, row) => sum + row.targetWeight,
    0,
  );
  if (parsed.data.targets.length > 0 && Math.abs(total - 1) > 0.005) {
    return { error: "errors.targetsMustTotal100" };
  }

  const now = new Date().toISOString();
  const wallets = parsed.data.targets.filter(
    (row) => !isSavingsAccountId(row.accountId),
  );
  const savings = parsed.data.targets.filter((row) =>
    isSavingsAccountId(row.accountId),
  );

  for (const row of savings) {
    const { error } = await db
      .from("savings_accounts")
      .update({ target_weight: row.targetWeight, updated_at: now })
      .eq("user_id", userId)
      .eq("kind", row.accountId as SavingsAccountKind);
    if (error) {
      return {
        error: savingsTargetsMissing(error)
          ? "placementsWeb.targetsSetup"
          : dbError(error),
      };
    }
  }

  if (wallets.length > 0) {
    const { error } = await db.from("wallet_plans").upsert(
      wallets.map((row) => ({
        user_id: userId,
        wallet: row.accountId as InvestmentWalletId,
        target_weight: row.targetWeight,
        updated_at: now,
      })),
      { onConflict: "user_id,wallet" },
    );
    if (error) {
      return { error: dbError(error) };
    }
  }

  return { success: true };
}

/**
 * Takes every target off, so the split goes back to showing what is alone.
 * The rest of each wallet's plan (the PEA's opening date, a ceiling, an
 * envelope fee) lives on the same rows and is left as it was.
 */
export async function clearAccountTargets(
  db: Db,
  userId: string,
): Promise<ActionResult> {
  const now = new Date().toISOString();
  const { error } = await db
    .from("wallet_plans")
    .update({ target_weight: null, updated_at: now })
    .eq("user_id", userId);
  if (error) {
    return { error: dbError(error) };
  }

  // Before 047 no savings account can hold a target, so there is none to take off.
  const { error: savingsError } = await db
    .from("savings_accounts")
    .update({ target_weight: null, updated_at: now })
    .eq("user_id", userId);
  if (savingsError && !savingsTargetsMissing(savingsError)) {
    return { error: dbError(savingsError) };
  }

  return { success: true };
}
