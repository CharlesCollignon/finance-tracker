import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiModel, type WriterState } from "@finance/core/ai-models";

export { ACCOUNT_ALLOWANCE } from "@finance/core/ai-models";
import { isFlagOn } from "@finance/core/flags";
import { describeModel, DEFAULT_WRITER_MODEL } from "@finance/core/model-name";
import type { Database } from "@finance/core/types/database";
import { flagsFor } from "../flags";
import { createAdminClient } from "../supabase/admin";
import { getSiteUrl } from "../supabase/env";
import { aiSealer } from "./secrets";

type Client = SupabaseClient<Database>;

/**
 * Who writes a user's reads, and on whose account
 * (docs/plans/AI_ACCOUNT_PLAN.md, Phase 2).
 *
 * Behind the `ai.account` flag. Off — every account until the connection is
 * opened to all — and nothing changes: Pluclair's own Mistral key writes, as
 * it always has, within the monthly allowances. On, the reads are the user's
 * own AI account's, through OpenRouter, with no allowance but the cooldown;
 * without a connected account, nothing is written at all.
 */

/** One way of reaching a model: everything a request needs but the prompt. */
export interface Writer {
  /** Pluclair's own key, or the user's AI account. */
  kind: "pluclair" | "account";
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
   * the door on everyone else's, nor Pluclair's on theirs.
   */
  label: string;
}

const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** The temperature the reads are written at, where a model takes one. */
const TEMPERATURE = 0.2;

/**
 * The model Pluclair's own key writes with, chosen on quality: a read is a
 * few thousand tokens, a few cents a month at most, so cost cannot decide
 * it. Small open models write sentences that do not parse — « your 720,00 €
 * left over is 720,00 € » — and put a figure where a category's name
 * belongs. `MISTRAL_MODEL` overrides it, and has to on Mistral's free plan,
 * whose keys reach only the open-weight models (`ministral-14b-latest`).
 */
export function pluclairModel(): string {
  return process.env.MISTRAL_MODEL?.trim() || DEFAULT_WRITER_MODEL;
}

/** Pluclair's own Mistral key, or null on a deployment without one. */
export function pluclairWriter(): Writer | null {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) {
    return null;
  }
  return {
    kind: "pluclair",
    model: pluclairModel(),
    endpoint: MISTRAL_ENDPOINT,
    key,
    temperature: TEMPERATURE,
    reasoning: false,
    extra: {},
    headers: {},
    label: "pluclair",
  };
}

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
 * Whether `ai.account` is on for this user.
 *
 * Through `client` when it acts as them — `evaluated_feature_flags()` reads
 * `auth.uid()`. A job that runs with the service role has no `auth.uid()`
 * and would be told every flag is off, so for it (`service`) the same rule
 * is read from the tables: the user's override, else the flag's default,
 * else whether the account was created after its cut-off.
 */
async function onAccount(
  userId: string,
  client: Client,
  service: boolean,
): Promise<boolean> {
  if (!service) {
    return isFlagOn(await flagsFor(client), "ai.account");
  }
  const [{ data: flag }, { data: override }] = await Promise.all([
    client
      .from("feature_flags")
      .select("enabled_by_default, enabled_from")
      .eq("key", "ai.account")
      .maybeSingle(),
    client
      .from("user_feature_flags")
      .select("enabled")
      .eq("user_id", userId)
      .eq("flag_key", "ai.account")
      .maybeSingle(),
  ]);
  if (override) {
    return override.enabled;
  }
  if (!flag) {
    return false;
  }
  if (flag.enabled_by_default) {
    return true;
  }
  if (!flag.enabled_from) {
    return false;
  }
  const { data } = await client.auth.admin.getUserById(userId);
  return Boolean(data.user && data.user.created_at >= flag.enabled_from);
}

/**
 * The writer for this user's next read. `account` says which rules apply:
 * true, the user's own account — no monthly allowance, and no writer at all
 * without a connection; false, Pluclair's key and its allowances.
 */
export async function writerFor(
  userId: string,
  client: Client,
  {
    service = false,
  }: {
    /** `client` holds the service role: a job, not the user asking. */
    service?: boolean;
  } = {},
): Promise<{ writer: Writer | null; account: boolean }> {
  if (!(await onAccount(userId, client, service))) {
    return { writer: pluclairWriter(), account: false };
  }
  return { writer: await accountWriter(userId), account: true };
}

export async function writerStateFor(
  userId: string,
  client: Client,
): Promise<WriterState> {
  if (!(await onAccount(userId, client, false))) {
    return {
      account: false,
      writable: pluclairWriter() !== null,
      name: describeModel(pluclairModel()).brand,
    };
  }
  const { data } = await client
    .from("ai_connections")
    .select("model")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    account: true,
    writable: data !== null && aiSealer.configured(),
    name: aiModel(data?.model).name,
  };
}
