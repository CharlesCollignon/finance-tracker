import type { ActionResult } from "@finance/core/action-result";
import { AI_MODELS, aiModel, type AiModel } from "@finance/core/ai-models";

import type { Db } from "./client";
import { dbError } from "./errors";

/**
 * A connected AI account, as the user's own rows (migration 053): whether
 * there is one, which model it writes with, and the two things the user
 * changes themselves — the model, and the connection's end. Connecting is
 * the server's (it holds the key); this is everything else, written once for
 * both Profiles.
 */

/** The connected account's model, or null with no account connected. */
export async function getAiConnection(
  db: Db,
  userId: string,
): Promise<AiModel | null> {
  const { data } = await db
    .from("ai_connections")
    .select("model")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? aiModel(data.model) : null;
}

/**
 * Write the next reads with another model. Only one on the short list:
 * OpenRouter would take any id, and the reads would be billed to a model
 * their checks were never run against.
 */
export async function chooseAiModel(
  db: Db,
  userId: string,
  modelId: string,
): Promise<ActionResult> {
  if (!AI_MODELS.some((model) => model.id === modelId)) {
    return { error: "errors.invalidInput" };
  }
  const { error } = await db
    .from("ai_connections")
    .update({ model: modelId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}

/**
 * Forget the account: the row, and its sealed key with it (the cascade).
 * The key itself lives on in the user's OpenRouter account until they
 * delete it there, which the Profile says before this is pressed.
 */
export async function disconnectAiAccount(
  db: Db,
  userId: string,
): Promise<ActionResult> {
  const { error } = await db
    .from("ai_connections")
    .delete()
    .eq("user_id", userId);
  return error ? { error: dbError(error) } : { success: true };
}
