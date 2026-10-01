"use server";

import { z } from "zod";
import { todayIsoLocal } from "@finance/core/constants";
import { ENVELOPE_SHORT_KEYS } from "@finance/core/future-plan";
import {
  FRENCH_SAVINGS_2026,
  SAVINGS_KINDS,
} from "@finance/core/savings-accounts";
import type { SavingsAccountKind } from "@finance/core/types/database";
import { walletIdSchema } from "@finance/core/validations/investments";
import { getAuthUser } from "@/lib/auth/get-user";
import { getT } from "@/lib/locale";
import { savingsSchemaMissing } from "@/lib/queries/savings-accounts";
import { revalidateApp } from "@/lib/revalidate-paths";
import { createClient } from "@/lib/supabase/server";

/**
 * Adding, changing and removing the accounts Placements keeps: savings
 * accounts (migration 046) and the investment wallets a user has.
 *
 * A savings account is one row per kind, fed by a savings category of its
 * own name — created on the spot, or the one already there — so what the
 * user logs as "LDDS" adds to the LDDS, and the recurring entries they file
 * there are what the Plan pays into it each month.
 */

type ActionResult = { error?: string; success?: boolean; message?: string };

const SETUP = "placementsWeb.setupNeeded";

const kindSchema = z.enum(
  SAVINGS_KINDS as [SavingsAccountKind, ...SavingsAccountKind[]],
);
const uuid = z.string().uuid();
const balanceSchema = z.number().finite().min(0).max(100_000_000);
/** A yearly rate as a fraction: 0.02 for 2%. */
const rateSchema = z.number().finite().min(0).max(0.2);

const addSavingsInput = z.object({
  kind: kindSchema,
  balance: balanceSchema.optional(),
  rate: rateSchema.nullable().optional(),
  bankAccountId: z.string().min(1).max(200).nullable().optional(),
});

/** Only a PEL's and a bank livret's rate are the user's to set. */
function ownRate(kind: SavingsAccountKind, rate: number | null | undefined) {
  if (kind !== "pel" && kind !== "livret") {
    return null;
  }
  if (rate === null || rate === undefined) {
    return null;
  }
  // The law's rate is stored as no rate, so it follows the law when it moves.
  return Math.abs(rate - FRENCH_SAVINGS_2026[kind].rate) < 1e-9 ? null : rate;
}

function failure(error: { code?: string; message: string }): ActionResult {
  return { error: savingsSchemaMissing(error) ? SETUP : error.message };
}

/** The savings category an account is fed by: its own name, made if missing. */
async function categoryFor(
  userId: string,
  name: string,
): Promise<{ id: string } | { error: ActionResult }> {
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("categories")
    .select("id, name, archived")
    .eq("user_id", userId)
    .eq("type", "savings");
  if (error) {
    return { error: failure(error) };
  }

  const match = (existing ?? []).find(
    (category) =>
      category.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  if (match) {
    if (match.archived) {
      await supabase
        .from("categories")
        .update({ archived: false })
        .eq("id", match.id)
        .eq("user_id", userId);
    }
    return { id: match.id };
  }

  const { data: created, error: createError } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name,
      type: "savings",
      icon: "piggy-bank",
      counts_toward_summary: true,
    })
    .select("id")
    .single();
  if (createError || !created) {
    return {
      error: failure(createError ?? { message: "errors.invalidInput" }),
    };
  }
  return { id: created.id };
}

export async function addSavingsAccount(input: {
  kind: string;
  balance?: number;
  rate?: number | null;
  bankAccountId?: string | null;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = addSavingsInput.safeParse(input);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const t = await getT();
  const supabase = await createClient();
  const { kind, bankAccountId } = parsed.data;
  const name = t(ENVELOPE_SHORT_KEYS[kind]);
  const today = todayIsoLocal();

  let balance = parsed.data.balance ?? 0;
  let balanceOn = today;
  if (bankAccountId) {
    const { data: bank } = await supabase
      .from("bank_accounts")
      .select("reported_balance, reported_on")
      .eq("user_id", user.id)
      .eq("provider_account_id", bankAccountId)
      .maybeSingle();
    if (!bank) {
      return { error: "errors.invalidInput" };
    }
    balance = Math.max(0, Number(bank.reported_balance ?? 0));
    balanceOn = bank.reported_on ?? today;
  }

  const category = await categoryFor(user.id, name);
  if ("error" in category) {
    return category.error;
  }

  const { error } = await supabase.from("savings_accounts").insert({
    user_id: user.id,
    kind,
    balance: Math.round(balance * 100) / 100,
    balance_on: balanceOn,
    annual_rate: ownRate(kind, parsed.data.rate),
    category_id: category.id,
    bank_account_id: bankAccountId ?? null,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "placementsWeb.alreadyAdded" };
    }
    return failure(error);
  }

  revalidateApp();
  return {
    success: true,
    message: t("accounts.addedSavings", { name, category: name }),
  };
}

export async function addWallet(wallet: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = walletIdSchema.safeParse(wallet);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("wallet_plans")
    .upsert(
      { user_id: user.id, wallet: parsed.data, shown: true },
      { onConflict: "user_id,wallet" },
    );
  if (error) {
    return failure(error);
  }

  const t = await getT();
  revalidateApp();
  return {
    success: true,
    message: t("accounts.added", { name: t(ENVELOPE_SHORT_KEYS[parsed.data]) }),
  };
}

/** The balance as the user reads it today. */
export async function updateSavingsBalance(
  id: string,
  balance: number,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  if (
    !uuid.safeParse(id).success ||
    !balanceSchema.safeParse(balance).success
  ) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("savings_accounts")
    .update({
      balance: Math.round(balance * 100) / 100,
      balance_on: todayIsoLocal(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return failure(error);
  }

  revalidateApp();
  return { success: true, message: "accounts.saved" };
}

/** A PEL's or a bank livret's own rate; null goes back to the default. */
export async function updateSavingsRate(
  id: string,
  rate: number | null,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  if (
    !uuid.safeParse(id).success ||
    (rate !== null && !rateSchema.safeParse(rate).success)
  ) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("savings_accounts")
    .select("kind")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await supabase
    .from("savings_accounts")
    .update({
      annual_rate: ownRate(row.kind, rate),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return failure(error);
  }

  revalidateApp();
  return { success: true, message: "accounts.saved" };
}

/**
 * Read the balance from a bank account, or stop. Stopping keeps the last
 * balance the bank reported as the user's own, on the day it was reported,
 * so the account does not drop to what was typed months ago.
 */
export async function linkSavingsBank(
  id: string,
  bankAccountId: string | null,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  if (!uuid.safeParse(id).success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("savings_accounts")
    .select("bank_account_id, balance, balance_on")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) {
    return { error: "errors.invalidInput" };
  }

  const target = bankAccountId ?? row.bank_account_id;
  const { data: bank } = target
    ? await supabase
        .from("bank_accounts")
        .select("reported_balance, reported_on")
        .eq("user_id", user.id)
        .eq("provider_account_id", target)
        .maybeSingle()
    : { data: null };
  if (bankAccountId && !bank) {
    return { error: "errors.invalidInput" };
  }

  const update =
    bankAccountId !== null
      ? { bank_account_id: bankAccountId }
      : {
          bank_account_id: null,
          balance:
            bank?.reported_balance === null ||
            bank?.reported_balance === undefined
              ? row.balance
              : Math.max(0, Number(bank.reported_balance)),
          balance_on: bank?.reported_on ?? row.balance_on,
        };

  const { error } = await supabase
    .from("savings_accounts")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return failure(error);
  }

  revalidateApp();
  return { success: true, message: "accounts.saved" };
}

/** The account goes; its category and what was logged in it stay. */
export async function removeSavingsAccount(id: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  if (!uuid.safeParse(id).success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("savings_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("kind")
    .maybeSingle();
  if (error) {
    return failure(error);
  }

  const t = await getT();
  revalidateApp();
  return {
    success: true,
    message: removed
      ? t("accounts.removed", { name: t(ENVELOPE_SHORT_KEYS[removed.kind]) })
      : undefined,
  };
}

/**
 * A wallet off Placements: its holdings go, and it is no longer kept. The
 * recurring entries that bought into it stay — saving one again puts its
 * holding back, which is the user saying they still invest there.
 */
export async function removeWallet(wallet: string): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = walletIdSchema.safeParse(wallet);
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error: positionsError } = await supabase
    .from("investment_positions")
    .delete()
    .eq("user_id", user.id)
    .eq("wallet", parsed.data);
  if (positionsError) {
    return failure(positionsError);
  }

  const { error } = await supabase
    .from("wallet_plans")
    .upsert(
      { user_id: user.id, wallet: parsed.data, shown: false },
      { onConflict: "user_id,wallet" },
    );
  if (error) {
    return failure(error);
  }

  const t = await getT();
  revalidateApp();
  return {
    success: true,
    message: t("accounts.removed", {
      name: t(ENVELOPE_SHORT_KEYS[parsed.data]),
    }),
  };
}
