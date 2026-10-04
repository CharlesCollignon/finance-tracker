import "server-only";
import { DEFAULT_AI_MODEL } from "@finance/core/ai-models";
import { createAdminClient } from "../supabase/admin";
import { getSiteUrl } from "../supabase/env";
import {
  authorizationUrl,
  checkKey,
  exchangeCode,
  newState,
  pkcePair,
} from "./openrouter";
import { aiSealer } from "./secrets";

/**
 * Connecting a user's AI account: the server's half of the round trip with
 * OpenRouter (docs/plans/AI_ACCOUNT_PLAN.md, Phase 1).
 *
 * `startConnection` is called for a user the route has already verified —
 * by their cookie on the web, by their bearer on the phone. It keeps a state
 * and a sealed PKCE verifier for ten minutes and answers where to send them.
 * `finishConnection` is the callback's: the state is the only proof of who
 * the user is (OpenRouter's redirect lands in a browser that may hold no
 * session at all — the phone's), so it is random, single use, short-lived,
 * and deleted the moment it is read. Both write with the service role,
 * because no client role can touch the flows or the sealed key.
 */

export type ConnectMode = "redirect" | "app";

/** As long as OpenRouter's own code lives. */
const FLOW_MINUTES = 10;

/** Where OpenRouter sends the user back to. Static, as a callback should be. */
function callbackUrl(): string {
  return `${getSiteUrl()}/api/ai/openrouter/callback`;
}

export async function startConnection(
  userId: string,
  mode: ConnectMode,
): Promise<{ url: string } | { error: string }> {
  const admin = createAdminClient();
  if (!admin || !aiSealer.configured()) {
    return { error: "aiAccount.unavailable" };
  }

  // Round trips nobody finished, gone with each new one rather than by a job.
  await admin
    .from("ai_connect_flows")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const state = newState();
  const { verifier, challenge } = pkcePair();
  const sealed = aiSealer.seal(verifier);
  const { error } = await admin.from("ai_connect_flows").insert({
    state,
    user_id: userId,
    verifier_ciphertext: sealed.ciphertext,
    key_id: sealed.keyId,
    mode,
    expires_at: new Date(Date.now() + FLOW_MINUTES * 60_000).toISOString(),
  });
  if (error) {
    return { error: "aiAccount.unavailable" };
  }

  return {
    url: authorizationUrl({ callbackUrl: callbackUrl(), challenge, state }),
  };
}

export type ConnectOutcome = "connected" | "refused" | "expired";

/** A round trip declined at OpenRouter: its state spent, and where it began. */
export async function abandonConnection(
  state: string,
): Promise<ConnectMode | null> {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }
  const { data } = await admin
    .from("ai_connect_flows")
    .delete()
    .eq("state", state)
    .select("mode")
    .maybeSingle();
  return (data?.mode as ConnectMode | undefined) ?? null;
}

/**
 * Finish a round trip: the state found and spent, the code exchanged, the
 * key checked, sealed and stored. The mode says where the user goes next;
 * null when the state names no round trip at all.
 */
export async function finishConnection(
  state: string,
  code: string,
): Promise<{ mode: ConnectMode | null; outcome: ConnectOutcome }> {
  const admin = createAdminClient();
  if (!admin || !aiSealer.configured()) {
    return { mode: null, outcome: "refused" };
  }

  // Read and spent in one statement: a state replayed finds nothing.
  const { data: flow } = await admin
    .from("ai_connect_flows")
    .delete()
    .eq("state", state)
    .select("user_id, verifier_ciphertext, key_id, mode, expires_at")
    .maybeSingle();
  if (!flow) {
    return { mode: null, outcome: "expired" };
  }
  const mode = flow.mode as ConnectMode;
  if (new Date(flow.expires_at).getTime() < Date.now()) {
    return { mode, outcome: "expired" };
  }

  let verifier: string;
  try {
    verifier = aiSealer.open({
      ciphertext: flow.verifier_ciphertext,
      keyId: flow.key_id,
    });
  } catch {
    return { mode, outcome: "refused" };
  }

  const key = await exchangeCode(code, verifier).catch(() => null);
  if (!key || !(await checkKey(key).catch(() => null))) {
    return { mode, outcome: "refused" };
  }

  // A reconnection keeps the model the user had chosen.
  const { data: existing } = await admin
    .from("ai_connections")
    .select("model")
    .eq("user_id", flow.user_id)
    .maybeSingle();
  const now = new Date().toISOString();
  const { error: connectionError } = await admin.from("ai_connections").upsert({
    user_id: flow.user_id,
    provider: "openrouter",
    model: existing?.model ?? DEFAULT_AI_MODEL.id,
    connected_at: now,
    last_error: null,
    updated_at: now,
  });
  if (connectionError) {
    return { mode, outcome: "refused" };
  }
  const sealed = aiSealer.seal(key);
  const { error: secretError } = await admin
    .from("ai_connection_secrets")
    .upsert({
      user_id: flow.user_id,
      ciphertext: sealed.ciphertext,
      key_id: sealed.keyId,
      created_at: now,
    });
  if (secretError) {
    // A connection without its key would claim an account it cannot use.
    await admin.from("ai_connections").delete().eq("user_id", flow.user_id);
    return { mode, outcome: "refused" };
  }

  return { mode, outcome: "connected" };
}
