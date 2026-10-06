import type { ActionResult } from "@finance/core/action-result";
import { cashDateOf } from "@finance/core/cash-date";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { monthLong } from "@finance/core/i18n/calendar-names";
import type { Locale } from "@finance/core/i18n/locale";
import { translator } from "@finance/core/i18n/t";
import { countsForMonthOf } from "@finance/core/recurring-fulfilment";
import { z } from "zod";

import type { Db } from "./client";
import { followPurchases } from "./dca-transfer";
import { isMissingSchema } from "./schema";
import { dbError } from "./errors";

/**
 * Confirming, refusing and undoing a fulfilment, for both apps.
 *
 * The whole point of this feature is that nothing here ever runs on its own.
 * An earlier version of the app matched bank rows to recurring templates
 * automatically, on amount and a five-day window, and had to grow a recovery
 * action for the ones it swallowed — so every one of these is the direct
 * result of a press, and the undo is a first-class action rather than an
 * afterthought.
 *
 * A missing table is reported here rather than swallowed: a silent no-op on
 * a button the user just pressed is the worst of the options, since the row
 * would reappear on the next load with no explanation. Messages that carry a
 * month or a date are written in the `locale` the caller hands in.
 */

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const pairing = z.object({
  templateId: uuid,
  occurredOn: isoDate,
  transactionId: uuid,
});

const SETUP_MESSAGE = "actions.fulfilmentSetup";

/** Yes: that movement is the occurrence this template called for. */
export async function fulfilOccurrence(
  db: Db,
  userId: string,
  templateId: string,
  occurredOn: string,
  transactionId: string,
  locale: Locale,
): Promise<ActionResult> {
  const parsed = pairing.safeParse({ templateId, occurredOn, transactionId });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  // Verified rather than trusted. The occurrence date and the template come
  // from a screen a stale tab could replay, and the transaction has to be
  // the caller's own — the row is keyed by user id, but a foreign transaction
  // id would otherwise be recorded against it.
  const [{ data: template }, { data: transaction }] = await Promise.all([
    db
      .from("recurring_templates")
      .select("id")
      .eq("id", parsed.data.templateId)
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("transactions")
      .select("*")
      .eq("id", parsed.data.transactionId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!template || !transaction) {
    return { error: "actions.recurringGone" };
  }

  const { error } = await db.from("recurring_fulfilments").upsert(
    {
      user_id: userId,
      template_id: parsed.data.templateId,
      occurred_on: parsed.data.occurredOn,
      transaction_id: parsed.data.transactionId,
    },
    { onConflict: "user_id,template_id,occurred_on" },
  );

  if (error) {
    if (isMissingSchema(error)) {
      return { error: SETUP_MESSAGE };
    }
    // The unique index on transaction_id is the one worth translating: it
    // means this movement is already standing in for a different occurrence.
    if (error.code === "23505") {
      return { error: "actions.movementTaken" };
    }
    return { error: dbError(error) };
  }

  // A transfer that follows the DCAs, once confirmed, is settled: the next
  // one, and the month after it, are the ones it stands for now.
  await followPurchases(db, userId, todayIsoLocal());

  // The month fills itself from its charges, so this occurrence may already
  // have a row the template wrote. The movement just confirmed is the real
  // one; the template's row would count the same rent twice.
  const { error: duplicateError } = await db
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("recurring_template_id", parsed.data.templateId)
    .eq("occurred_on", parsed.data.occurredOn);

  if (duplicateError) {
    return { error: dbError(duplicateError) };
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

  if (!countsFor) {
    return { success: true, message: "actions.counted" };
  }

  const { error: moveError } = await db
    .from("transactions")
    .update({ occurred_on: parsed.data.occurredOn, cash_on: movedOn })
    .eq("id", parsed.data.transactionId)
    .eq("user_id", userId);

  if (moveError) {
    return {
      error: isMissingSchema(moveError)
        ? "actions.cashDateSetup"
        : dbError(moveError),
    };
  }

  return {
    success: true,
    message: translator(locale)("actions.countedForMonth", {
      month: monthLong(Number(countsFor.slice(5, 7)), locale),
    }),
  };
}

/**
 * Put an income that was counted for next month back on the day its money
 * arrived, and undo the confirmation that moved it. The row's own Undo, from
 * the edit sheet: the "did this arrive?" question does not come back on its
 * own for a pairing already confirmed.
 */
export async function moveBackEarlyIncome(
  db: Db,
  userId: string,
  transactionId: string,
  locale: Locale,
): Promise<ActionResult> {
  if (!uuid.safeParse(transactionId).success) {
    return { error: "errors.invalidInput" };
  }

  const { data: transaction } = await db
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!transaction?.cash_on) {
    return { error: "actions.transactionNotFound" };
  }

  const { error: unlinkError } = await db
    .from("recurring_fulfilments")
    .delete()
    .eq("user_id", userId)
    .eq("transaction_id", transactionId);
  if (unlinkError && !isMissingSchema(unlinkError)) {
    return { error: dbError(unlinkError) };
  }

  const { error } = await db
    .from("transactions")
    .update({ occurred_on: transaction.cash_on, cash_on: null })
    .eq("id", transactionId)
    .eq("user_id", userId);
  if (error) {
    return { error: dbError(error) };
  }

  return {
    success: true,
    message: translator(locale)("actions.movedBack", {
      date: formatShortDate(transaction.cash_on, locale),
    }),
  };
}

/**
 * No: that is not what this charge was. The refusal names the pair, so a
 * better candidate for the same occurrence is still offered — which the
 * message says, rather than promising the question is gone.
 */
export async function refuseFulfilment(
  db: Db,
  userId: string,
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const parsed = pairing.safeParse({ templateId, occurredOn, transactionId });
  if (!parsed.success) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db.from("recurring_fulfilment_refusals").upsert(
    {
      user_id: userId,
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
    return { error: isMissingSchema(error) ? SETUP_MESSAGE : dbError(error) };
  }

  return { success: true, message: "actions.pairingDismissed" };
}

/** Take a confirmation back, and put the occurrence back in the forecast. */
export async function undoFulfilment(
  db: Db,
  userId: string,
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  if (
    !uuid.safeParse(templateId).success ||
    !isoDate.safeParse(occurredOn).success
  ) {
    return { error: "errors.invalidInput" };
  }

  // The row this confirmation moved to the occurrence's month, if it moved
  // one, goes back to the day its money arrived.
  const { data: fulfilment } = await db
    .from("recurring_fulfilments")
    .select("transaction_id")
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn)
    .maybeSingle();

  const { error } = await db
    .from("recurring_fulfilments")
    .delete()
    .eq("user_id", userId)
    .eq("template_id", templateId)
    .eq("occurred_on", occurredOn);

  if (error) {
    return { error: isMissingSchema(error) ? SETUP_MESSAGE : dbError(error) };
  }

  if (fulfilment?.transaction_id) {
    const { data: moved } = await db
      .from("transactions")
      .select("*")
      .eq("id", fulfilment.transaction_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (moved?.cash_on && moved.occurred_on === occurredOn) {
      await db
        .from("transactions")
        .update({ occurred_on: moved.cash_on, cash_on: null })
        .eq("id", moved.id)
        .eq("user_id", userId);
    }
  }

  // Back in play, a transfer that follows the DCAs covers its month again.
  await followPurchases(db, userId, todayIsoLocal());

  return { success: true, message: "actions.backInForecast" };
}
