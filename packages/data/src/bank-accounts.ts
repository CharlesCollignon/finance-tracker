import type { ActionResult } from "@finance/core/action-result";
import type { BankAccountRole } from "@finance/core/types/database";
import { z } from "zod";

import type { Db } from "./client";
import { dbError } from "./errors";
import { linkSavingsBank } from "./savings-accounts";

const roleSchema = z.enum(["spending", "savings", "ignored"]);
const accountIdSchema = z.string().min(1).max(200);

/**
 * Say what a bank account is: Courant, Épargne or Ne pas suivre.
 *
 * Anything but Épargne lets go of a Livret that read its balance from the
 * account, keeping the last balance the bank reported as the Livret's own —
 * otherwise the same money would count twice, on Le point as spending money
 * and on Placements as savings. What the account already brought into the
 * ledger stays either way; only what comes next follows the new role.
 */
export async function setBankAccountRole(
  db: Db,
  userId: string,
  providerAccountId: string,
  role: BankAccountRole,
): Promise<ActionResult> {
  if (
    !accountIdSchema.safeParse(providerAccountId).success ||
    !roleSchema.safeParse(role).success
  ) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db
    .from("bank_accounts")
    .update({ role })
    .eq("user_id", userId)
    .eq("provider_account_id", providerAccountId);
  if (error) {
    return { error: dbError(error) };
  }

  if (role !== "savings") {
    const { data: livrets } = await db
      .from("savings_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("bank_account_id", providerAccountId);
    for (const livret of livrets ?? []) {
      const unlinked = await linkSavingsBank(db, userId, livret.id, null);
      if (unlinked.error !== undefined) {
        return unlinked;
      }
    }
  }

  return { success: true };
}
