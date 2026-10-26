"use server";

import type { ActionResult } from "@finance/core/action-result";
import type { ReadEvent } from "@finance/core/investment-events";
import type { InvestmentEventInput } from "@finance/core/validations/investment-events";
import * as events from "@finance/data/investment-events";
import { asUser } from "@/lib/actions/as-user";

/**
 * What happened inside a wallet (migration 080): typed in, read off a
 * broker's file, deleted — `@finance/data/investment-events`, which the
 * phone calls too. A wallet is a person's, never a space's, so these run
 * as the user, not the owner on screen.
 */

/** A broker's export is a few hundred lines a year; more is not one file. */
const MAX_IMPORT = 5000;

export async function addInvestmentEvent(
  input: InvestmentEventInput,
): Promise<ActionResult<{ id: string }>> {
  return asUser((db, userId) => events.addInvestmentEvent(db, userId, input));
}

export async function deleteInvestmentEvent(id: string): Promise<ActionResult> {
  return asUser((db, userId) => events.deleteInvestmentEvent(db, userId, id));
}

export async function importInvestmentEvents(
  read: ReadEvent[],
): Promise<ActionResult<{ added: number; known: number }>> {
  if (read.length > MAX_IMPORT) {
    return { error: "statements.tooBig" };
  }
  return asUser((db, userId) =>
    events.importInvestmentEvents(db, userId, read),
  );
}
