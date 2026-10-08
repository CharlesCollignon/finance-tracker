"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@finance/core/action-result";
import { deleteConversation } from "@finance/data/ask";
import { askQuestion, type AskOutcome } from "@/lib/ask/ask";
import { getAuthUser } from "@/lib/auth/get-user";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

/**
 * Ask Pluclair from the web: one question into a conversation (a new one
 * when none is given). Always the person's own money — never the space's.
 */
export async function askAction(
  question: string,
  conversationId: string | null,
): Promise<AskOutcome> {
  const user = await getAuthUser();
  if (!user) {
    return {
      conversationId,
      message: "errors.notAuthenticated",
      questionsLeft: null,
    };
  }
  const outcome = await askQuestion(await createClient(), user.id, {
    question: typeof question === "string" ? question : "",
    conversationId:
      typeof conversationId === "string" && conversationId
        ? conversationId
        : null,
    locale: await getLocale(),
  });
  revalidatePath("/ask");
  return outcome;
}

/** A conversation, gone with its messages. */
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
