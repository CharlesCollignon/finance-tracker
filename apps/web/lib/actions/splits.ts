"use server";

import type { ActionResult } from "@finance/core/action-result";
import type { SplitInput } from "@finance/core/validations/splits";
import * as splits from "@finance/data/splits";
import { asOwner } from "@/lib/actions/as-user";

/** One payment in several parts, and back (migration 079). */

export async function splitTransactionAction(
  input: SplitInput,
): Promise<ActionResult<{ ids: string[] }>> {
  return asOwner((db, ownerId) => splits.splitTransaction(db, ownerId, input));
}

export async function unsplitTransactionAction(
  id: string,
): Promise<ActionResult> {
  return asOwner((db, ownerId) => splits.unsplitTransaction(db, ownerId, id));
}
