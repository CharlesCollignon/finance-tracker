import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiModel, type WriterState } from "@finance/core/ai-models";

export { ACCOUNT_ALLOWANCE } from "@finance/core/ai-models";
import type { Database } from "@finance/core/types/database";
import { createAdminClient } from "../supabase/admin";
import { getSiteUrl } from "../supabase/env";
import { aiSealer } from "./secrets";

type Client = SupabaseClient<Database>;

/**
 * Who writes a person's reads and answers their questions: their own AI
 * account, through OpenRouter, and nothing else (the owner's call,
 * 2026-10-09). Pluclair holds no model key of its own: without a connected
 * account there is no writer, and the screens invite the person to connect
 * one. No monthly allowance on one's own account — only the cooldown and the
 * guard against a double press.
 */

/** One way of reaching a model: everything a request needs but the prompt. */
export interface Writer {
  /** The person's own AI account, the one kind there is. */
  kind: "account";
  /** The model id sent, and recorded on every read it writes. */
  model: string;
  endpoint: string;
  key: string;
  /** Null for a model that refuses one (the GPT-6 family). */
  temperature: number | null;
  /** A model that reasons before it answers: see `./sampling`. */
  reasoning: boolean;
  /** Anything else the service wants in the request body. */
  extra: Record<string, unknown>;
  /** Headers beyond the key. */
  headers: Record<string, string>;
  /**
   * One failure count per label: a user's failing account must never close
   * the door on everyone else's.
   */
  label: string;
}

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** The temperature the reads are written at, where a model takes one. */
const TEMPERATURE = 0.2;

/** A user's connected AI account, opened for one request; null without one. */
async function accountWriter(userId: string): Promise<Writer | null> {
  const admin = createAdminClient();
  if (!admin || !aiSealer.configured()) {
    return null;
  }
  const [{ data: connection }, { data: secret }] = await Promise.all([
    admin
      .from("ai_connections")
      .select("model")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("ai_connection_secrets")
      .select("ciphertext, key_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!connection || !secret) {
    return null;
  }

  let key: string;
  try {
    key = aiSealer.open({
      ciphertext: secret.ciphertext,
      keyId: secret.key_id,
    });
  } catch {
    return null;
  }

  const model = aiModel(connection.model);
  return {
    kind: "account",
    model: model.id,
    endpoint: OPENROUTER_ENDPOINT,
    key,
    temperature: model.reasoning ? null : TEMPERATURE,
    reasoning: model.reasoning,
    // Only to a provider that honours the response schema: a read whose
    // shape was ignored is one the user paid for and cannot use.
    extra: { provider: { require_parameters: true } },
    // OpenRouter's attribution headers: the app the key is used from.
    headers: { "HTTP-Referer": getSiteUrl(), "X-Title": "Pluclair" },
    label: `account:${userId}`,
  };
}

/**
 * The writer for this person's next read or question: their own connected
 * AI account, or none — and then nothing is written.
 */
export function writerFor(userId: string): Promise<Writer | null> {
  return accountWriter(userId);
}

/**
 * What a screen needs to know of the writer: whether there is one, and its
 * model's name. Without a connected account, nothing is writable and the
 * screens invite the person to connect one.
 */
export async function writerStateFor(
  userId: string,
  client: Client,
): Promise<WriterState> {
  const { data } = await client
    .from("ai_connections")
    .select("model")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !aiSealer.configured()) {
    return { account: false, writable: false, name: "" };
  }
  return { account: true, writable: true, name: aiModel(data.model).name };
}
