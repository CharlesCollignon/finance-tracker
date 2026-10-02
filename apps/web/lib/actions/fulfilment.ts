"use server";

import { z } from "zod";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { revalidateApp } from "@/lib/revalidate-paths";
import { getLocale, getT } from "@/lib/locale";
import { cashDateOf } from "@finance/core/cash-date";
import { formatShortDate } from "@finance/core/constants";
import { monthLong } from "@finance/core/i18n/calendar-names";
import { countsForMonthOf } from "@finance/core/recurring-fulfilment";

/**
 * Confirming, refusing and undoing a fulfilment.
 *
 * The whole point of this feature is that nothing here ever runs on its own.
 * An earlier version of the app matched bank rows to recurring templates
 * automatically, on amount and a five-day window, and had to grow a recovery
 * action for the ones it swallowed — so every one of these is the direct
 * result of a press, and the undo is a first-class action rather than an
 * afterthought.
 */

type ActionResult = { error?: string; success?: boolean; message?: string };

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const input = z.object({
  templateId: uuid,
  occurredOn: isoDate,
  transactionId: uuid,
});

/**
 * Whether an error means migration 023 has not run.
 *
 * Reported rather than swallowed here. A silent no-op on a button the user
 * just pressed is the worst of the options: the row would reappear on the
 * next load with no explanation.
 */
function schemaMissing(error: { code?: string } | null): boolean {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "42703"
  );
}

const SETUP_MESSAGE = "actions.fulfilmentSetup";

/** Yes: that movement is the occurrence this template called for. */
export async function fulfilOccurrence(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = input.safeParse({ templateId, occurredOn, transactionId });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();

  // Verified rather than trusted. The occurrence date and the template come
  // from a form that a stale tab could replay, and the transaction has to be
  // the caller's own — the row is keyed by user id, but a foreign transaction
  // id would otherwise be recorded against it.
  const [{ data: template }, { data: transaction }] = await Promise.all([
    supabase
      .from("recurring_templates")
      .select("id")
      .eq("id", parsed.data.templateId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("*")
      .eq("id", parsed.data.transactionId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!template || !transaction) {
    return { error: "actions.recurringGone" };
  }

  const { error } = await supabase.from("recurring_fulfilments").upsert(
    {
      user_id: user.id,
      template_id: parsed.data.templateId,
      occurred_on: parsed.data.occurredOn,
      transaction_id: parsed.data.transactionId,
    },
    { onConflict: "user_id,template_id,occurred_on" },
  );

  if (error) {
    if (schemaMissing(error)) {
      return { error: SETUP_MESSAGE };
    }
    // The unique index on transaction_id is the one worth translating: it
    // means this movement is already standing in for a different occurrence.
    if (error.code === "23505") {
      return {
        error: "actions.movementTaken",
      };
    }
    return { error: error.message };
  }

  // The month fills itself from its charges, so this occurrence may already
  // have a row the template wrote. The movement just confirmed is the real
  // one; the template's row would count the same rent twice.
  const { error: duplicateError } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", user.id)
    .eq("recurring_template_id", parsed.data.templateId)
    .eq("occurred_on", parsed.data.occurredOn);

  if (duplicateError) {
    return { error: duplicateError.message };
  }

  // A planned item counts in the month it was planned for: a payment whose
  // money moved in another month — the October salary on 22 September, the
  // savings put by with it, the one that only arrived on 2 November — moves
  // to the occurrence's day, and the day the money moved is kept for the
  // month close and the balance (`cash_on`, migration 045).
  const movedOn = cashDateOf(transaction);
  const countsFor = countsForMonthOf(
    { occurredOn: parsed.data.occurredOn },
    movedOn,
  );

  if (countsFor) {
    const { error: moveError } = await supabase
      .from("transactions")
      .update({ occurred_on: parsed.data.occurredOn, cash_on: movedOn })
      .eq("id", parsed.data.transactionId)
      .eq("user_id", user.id);
    if (moveError) {
      revalidateApp();
      return {
        error: schemaMissing(moveError)
          ? "actions.cashDateSetup"
          : moveError.message,
      };
    }
    const t = await getT();
    revalidateApp();
    return {
      success: true,
      message: t("actions.countedForMonth", {
        month: monthLong(Number(countsFor.slice(5, 7)), await getLocale()),
      }),
    };
  }

  revalidateApp();
  return { success: true, message: "actions.counted" };
}

/**
 * Put an income that was counted for next month back on the day its money
 * arrived, and undo the confirmation that moved it. The row's own Undo, from
 * the edit sheet: the "did this arrive?" question does not come back on its
 * own for a pairing already confirmed.
 */
export async function moveBackEarlyIncome(
  transactionId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }
  if (!uuid.safeParse(transactionId).success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!transaction?.cash_on) {
    return { error: "actions.transactionNotFound" };
  }

  const { error: unlinkError } = await supabase
    .from("recurring_fulfilments")
    .delete()
    .eq("user_id", user.id)
    .eq("transaction_id", transactionId);
  if (unlinkError && !schemaMissing(unlinkError)) {
    return { error: unlinkError.message };
  }

  const { error } = await supabase
    .from("transactions")
    .update({ occurred_on: transaction.cash_on, cash_on: null })
    .eq("id", transactionId)
    .eq("user_id", user.id);
  if (error) {
    return { error: error.message };
  }

  const t = await getT();
  revalidateApp();
  return {
    success: true,
    message: t("actions.movedBack", {
      date: formatShortDate(transaction.cash_on, await getLocale()),
    }),
  };
}

/** No: that is not what this charge was. */
export async function refuseFulfilment(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  const parsed = input.safeParse({ templateId, occurredOn, transactionId });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("recurring_fulfilment_refusals").upsert(
    {
      user_id: user.id,
      template_id: parsed.data.templateId,
      occurred_on: parsed.data.occurredOn,
      transaction_id: parsed.data.transactionId,
    },
    {
      onConflict: "user_id,template_id,occurred_on,transaction_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    if (schemaMissing(error)) {
      return { error: SETUP_MESSAGE };
    }
    return { error: error.message };
  }

  revalidateApp();
  // Deliberately says what it will and will not do. The refusal names the
  // pair, so a better candidate for the same occurrence is still offered.
  return { success: true, message: "actions.pairingDismissed" };
}

/** Take a confirmation back, and put the occurrence back in the forecast. */
export async function undoFulfilment(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "errors.notAuthenticated" };
  }

  if (
    !uuid.safeParse(templateId).success ||
    !isoDate.safeParse(occurredOn).success
  ) {
    return { error: "errors.invalidInput" };
  }

  const supabase = await createClient();

  // The row this confirmation moved to the occurrence's month, if it moved
  // one, goes back to the day its money arrived.
  const { data: fulfilment } = await supabase
    .from("recurring_fulfilments")
    .select("transaction_id")
    .eq("user_id", user.id)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn)
    .maybeSingle();

  const { error } = await supabase
    .from("recurring_fulfilments")
    .delete()
    .eq("user_id", user.id)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn);

  if (error) {
    if (schemaMissing(error)) {
      return { error: SETUP_MESSAGE };
    }
    return { error: error.message };
  }

  if (fulfilment?.transaction_id) {
    const { data: moved } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", fulfilment.transaction_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (moved?.cash_on && moved.occurred_on === occurredOn) {
      await supabase
        .from("transactions")
        .update({ occurred_on: moved.cash_on, cash_on: null })
        .eq("id", moved.id)
        .eq("user_id", user.id);
    }
  }

  revalidateApp();
  return { success: true, message: "actions.backInForecast" };
}
