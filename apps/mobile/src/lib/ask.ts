import type { AskStreamEvent } from "@finance/core/ask-chat";
import type { CurrencyCode } from "@finance/core/constants";
import type { Locale } from "@finance/core/i18n/locale";
import * as ask from "@finance/data/ask";

import { announcingFetch } from "@/lib/data-version";
import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * Ask Pluclair on the phone: the conversations read and deleted straight
 * from Supabase, the question asked through the web's streaming route,
 * which opens the person's own AI account (`api/ask/stream`).
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

/**
 * One question into a conversation — a new one when none is given — in the
 * reader's language and currency, its answer handed to `onEvent` as it is
 * written: each tool the model calls, the words, then the conversation it
 * was kept in, or why there is no answer.
 *
 * The phone's own fetch (`expo/fetch`, global on native) reads the body as
 * it comes; one that cannot still gets every event, all at once at the end.
 * Throws when the server cannot be reached or `signal` stops it.
 */
export async function streamQuestion(
  {
    question,
    conversationId,
    locale,
    currency,
  }: {
    question: string;
    conversationId: string | null;
    locale: Locale;
    currency: CurrencyCode;
  },
  onEvent: (event: AskStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  if (!WEB_APP_URL) {
    onEvent({ type: "error", message: "bankConnect.unavailable" });
    return;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    onEvent({ type: "error", message: "errors.notAuthenticated" });
    return;
  }

  const response = await announcingFetch(`${WEB_APP_URL}/api/ask/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, conversationId, locale, currency }),
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    onEvent({
      type: "error",
      message: typeof body?.error === "string" ? body.error : "ask.noAnswer",
    });
    return;
  }

  // One JSON event a line; a line cut between two chunks waits for its end.
  let buffer = "";
  const take = (text: string) => {
    buffer += text;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) {
        onEvent(JSON.parse(line) as AskStreamEvent);
      }
    }
  };

  const reader = response.body?.getReader();
  if (!reader) {
    take(`${await response.text()}\n`);
    return;
  }
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    take(decoder.decode(value, { stream: true }));
  }
  take(`${decoder.decode()}\n`);
}
