"use server";

import type { ActionResult } from "@finance/core/action-result";
import { todayIsoLocal } from "@finance/core/constants";
import type { FulfilmentMiss } from "@finance/core/recurring-fulfilment";
import * as decisions from "@finance/data/fulfilment-decisions";
import { explainAwaited } from "@finance/data/fulfilment";
import { asOwner } from "@/lib/actions/as-user";
import { getLocale } from "@/lib/locale";

/**
 * Confirming, refusing and undoing a fulfilment — the writes are
 * `@finance/data/fulfilment-decisions`, shared with the phone. Confirming
 * redraws even when it fails halfway: by then the pairing is recorded, and a
 * row that could not be moved to its month is still the row the page shows.
 */

export async function fulfilOccurrence(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  const locale = await getLocale();
  return asOwner(
    (db, userId) =>
      decisions.fulfilOccurrence(
        db,
        userId,
        templateId,
        occurredOn,
        transactionId,
        locale,
      ),
    { redraw: "always" },
  );
}

export async function moveBackEarlyIncome(
  transactionId: string,
): Promise<ActionResult> {
  const locale = await getLocale();
  return asOwner((db, userId) =>
    decisions.moveBackEarlyIncome(db, userId, transactionId, locale),
  );
}

export async function refuseFulfilment(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  return asOwner((db, userId) =>
    decisions.refuseFulfilment(
      db,
      userId,
      templateId,
      occurredOn,
      transactionId,
    ),
  );
}

export async function undoFulfilment(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult> {
  return asOwner((db, userId) =>
    decisions.undoFulfilment(db, userId, templateId, occurredOn),
  );
}

/**
 * Why the bank has not brought an occurrence yet — what the « Pas encore
 * passé » sheet says under its date. A read: nothing is redrawn.
 */
export async function explainAwaitedOccurrence(
  templateId: string,
  occurredOn: string,
): Promise<ActionResult<{ miss: FulfilmentMiss | null }>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    return { error: "errors.invalidInput" };
  }
  return asOwner(
    async (db, userId) => ({
      success: true,
      miss: await explainAwaited(
        db,
        userId,
        templateId,
        occurredOn,
        todayIsoLocal(),
      ),
    }),
    { redraw: "never" },
  );
}
