"use server";

import type { ActionResult } from "@finance/core/action-result";
import * as aiConnection from "@finance/data/ai-connection";
import { asUser } from "@/lib/actions/as-user";

/** Write the next reads with another model on the short list. */
export async function chooseAiModel(modelId: string): Promise<ActionResult> {
  return asUser((db, userId) =>
    aiConnection.chooseAiModel(db, userId, modelId),
  );
}

/** Forget the connected AI account, and its key. */
export async function disconnectAiAccount(): Promise<ActionResult> {
  return asUser((db, userId) => aiConnection.disconnectAiAccount(db, userId));
}
