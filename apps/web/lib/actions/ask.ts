"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@finance/core/action-result";
import { deleteConversation } from "@finance/data/ask";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Ask Pluclair's one action: a conversation, gone with its messages. A
 * question is asked through `api/ask/stream`, which streams its answer.
 */
export async function deleteConversationAction(
  conversationId: string,
): Promise<ActionResult> {
  if (!(await getAuthUser())) {
    return { error: "errors.notAuthenticated" };
  }
  await deleteConversation(await createClient(), conversationId);
  revalidatePath("/ask");
  return { success: true, message: "ask.deleted" };
}
