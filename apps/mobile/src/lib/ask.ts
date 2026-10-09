import type { Locale } from "@finance/core/i18n/locale";
import * as ask from "@finance/data/ask";

import { supabase } from "@/lib/supabase";
import { callWebApi } from "@/lib/web-api";

/**
 * Ask Pluclair on the phone: the conversations read and deleted straight
 * from Supabase, the question asked through the web's route, which opens
 * the person's own AI account (`api/ask`).
 */

export type AskConversation = ask.AskConversation;
export type AskMessage = ask.AskMessage;

export function listConversations(userId: string): Promise<AskConversation[]> {
  return ask.listConversations(supabase, userId);
}

export function getConversationMessages(
  conversationId: string,
): Promise<AskMessage[]> {
  return ask.getConversationMessages(supabase, conversationId);
}

export function deleteConversation(conversationId: string): Promise<void> {
  return ask.deleteConversation(supabase, conversationId);
}

export interface AskOutcome {
  conversationId: string | null;
  /** A message key or a sentence, when there is no answer. */
  message: string | null;
}

/** One question into a conversation — a new one when none is given. */
export async function askQuestion(
  question: string,
  conversationId: string | null,
  locale: Locale,
): Promise<AskOutcome> {
  const result = await callWebApi<AskOutcome>("/api/ask", {
    body: { question, conversationId, locale },
  });
  return result.ok
    ? { conversationId: result.conversationId, message: result.message }
    : { conversationId, message: result.error };
}
