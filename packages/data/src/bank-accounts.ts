import type { ActionResult } from "@finance/core/action-result";
import { SAVINGS_KINDS } from "@finance/core/savings-accounts";
import type {
  BankAccountRole,
  SavingsAccountKind,
} from "@finance/core/types/database";
import { z } from "zod";

import type { Db } from "./client";
import { dbError } from "./errors";
import { addSavingsAccount, linkSavingsBank } from "./savings-accounts";

const roleSchema = z.enum(["spending", "savings", "ignored", "joint"]);
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

  // « Compte commun » feeds the space the person is in (migration 061);
  // without one there is nothing for it to feed.
  let spaceId: string | null = null;
  if (role === "joint") {
    const { data: membership } = await db
      .from("space_members")
      .select("space_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      return { error: "errors.notAllowed" };
    }
    spaceId = membership.space_id;
  }

  const { error } = await db
    .from("bank_accounts")
    .update(role === "joint" ? { role, space_id: spaceId } : { role })
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

/** What became of the Livret an account was filed as Épargne for. */
export type LivretOutcome =
  /** It reads this account now, or already did. */
  | "linked"
  /** The user had none of that kind: it was made, reading this account. */
  | "created"
  /** One of that kind already reads another account, and keeps it. */
  | "taken";

/**
 * Say what a bank account is and, as Épargne, which Livret it is: the
 * Livret of that kind on Placements then reads its balance from it — made on
 * the spot under `livretName` when the user has none yet, which is what lets
 * one « C'est bon » set up a Livret A without a visit to Placements.
 *
 * A Livret of that kind already read from another bank account keeps it: the
 * account stays Épargne, feeding nothing, and the caller says so. Switching
 * an account from one Livret to another lets go of the first, which keeps
 * the last balance the bank gave as its own.
 */
export async function fileBankAccount(
  db: Db,
  userId: string,
  input: {
    accountId: string;
    role: BankAccountRole;
    savingsKind?: SavingsAccountKind | null;
    livretName?: string;
  },
): Promise<ActionResult<{ livret: LivretOutcome | null }>> {
  const kind = input.savingsKind ?? null;
  if (kind !== null && !SAVINGS_KINDS.includes(kind)) {
    return { error: "errors.invalidInput" };
  }

  const filed = await setBankAccountRole(
    db,
    userId,
    input.accountId,
    input.role,
  );
  if (filed.error !== undefined) {
    return { error: filed.error };
  }
  if (input.role !== "savings" || kind === null) {
    return { success: true, livret: null };
  }

  const { data: livrets, error } = await db
    .from("savings_accounts")
    .select("id, kind, bank_account_id")
    .eq("user_id", userId);
  if (error) {
    return { error: dbError(error) };
  }

  const current = (livrets ?? []).find(
    (livret) => livret.bank_account_id === input.accountId,
  );
  if (current?.kind === kind) {
    return { success: true, livret: "linked" };
  }
  if (current) {
    const unlinked = await linkSavingsBank(db, userId, current.id, null);
    if (unlinked.error !== undefined) {
      return { error: unlinked.error };
    }
  }

  const target = (livrets ?? []).find((livret) => livret.kind === kind);
  if (target) {
    if (target.bank_account_id !== null) {
      return { success: true, livret: "taken" };
    }
    const linked = await linkSavingsBank(
      db,
      userId,
      target.id,
      input.accountId,
    );
    return linked.error !== undefined
      ? { error: linked.error }
      : { success: true, livret: "linked" };
  }

  const created = await addSavingsAccount(db, userId, {
    kind,
    name: input.livretName ?? "",
    bankAccountId: input.accountId,
  });
  return created.error !== undefined
    ? { error: created.error }
    : { success: true, livret: "created" };
}
