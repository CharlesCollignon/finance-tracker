"use server";

import type { ActionResult } from "@finance/core/action-result";
import * as decisions from "@finance/data/fulfilment-decisions";
import { asUser } from "@/lib/actions/as-user";
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
  return asUser(
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
  return asUser((db, userId) =>
    decisions.moveBackEarlyIncome(db, userId, transactionId, locale),
  );
}

export async function refuseFulfilment(
  templateId: string,
  occurredOn: string,
  transactionId: string,
): Promise<ActionResult> {
  return asUser((db, userId) =>
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
  return asUser((db, userId) =>
    decisions.undoFulfilment(db, userId, templateId, occurredOn),
  );
}
