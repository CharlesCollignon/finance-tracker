import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * OpenRouter's side of connecting an AI account: OAuth with PKCE, as its
 * documentation describes it (https://openrouter.ai/docs/guides/overview/auth/oauth).
 *
 * The user is sent to `/auth` with a code challenge and our state; they
 * approve, and OpenRouter sends them back to the callback with a code and
 * the state unchanged. The code — valid ten minutes, once — and the verifier
 * behind the challenge buy an API key created for that user, under their own
 * account, credits and limits. Nothing here keeps state: the verifier is
 * sealed into `ai_connect_flows` by the caller.
 *
 * Nothing here logs a key or a response body.
 */

const AUTH_URL = "https://openrouter.ai/auth";
const KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";
const KEY_INFO_URL = "https://openrouter.ai/api/v1/key";

/** The label the user sees on the key in their OpenRouter account. */
const KEY_LABEL = "Pluclair";

/** Long enough for OpenRouter to answer, short enough not to hang a callback. */
const TIMEOUT_MS = 15_000;

type Fetch = typeof fetch;

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

/** A PKCE pair: the verifier kept on the server, the S256 challenge sent. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** A random, single-use OAuth state. */
export function newState(): string {
  return base64Url(randomBytes(24));
}

/** Where to send the user to approve the connection. */
export function authorizationUrl({
  callbackUrl,
  challenge,
  state,
}: {
  callbackUrl: string;
  challenge: string;
  state: string;
}): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("callback_url", callbackUrl);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("key_label", KEY_LABEL);
  url.searchParams.set("state", state);
  return url.toString();
}

async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** The code and its verifier, exchanged for the user's key; null on refusal. */
export async function exchangeCode(
  code: string,
  verifier: string,
  fetchImpl: Fetch = fetch,
): Promise<string | null> {
  return withTimeout(async (signal) => {
    const response = await fetchImpl(KEYS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        code_challenge_method: "S256",
      }),
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json().catch(() => null)) as {
      key?: unknown;
    } | null;
    return typeof body?.key === "string" && body.key.trim() !== ""
      ? body.key.trim()
      : null;
  });
}

/** What OpenRouter says about a key: that it works, and what it may spend. */
export interface KeyInfo {
  /** Credits spent through this key, in US dollars. */
  usage: number;
  /** Its spending limit in US dollars, or null without one. */
  limit: number | null;
}

/** Whether the key works, and what it may spend; null when it does not. */
export async function checkKey(
  key: string,
  fetchImpl: Fetch = fetch,
): Promise<KeyInfo | null> {
  return withTimeout(async (signal) => {
    const response = await fetchImpl(KEY_INFO_URL, {
      headers: { Authorization: `Bearer ${key}` },
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json().catch(() => null)) as {
      data?: { usage?: unknown; limit?: unknown };
    } | null;
    const data = body?.data;
    if (!data) {
      return null;
    }
    return {
      usage: typeof data.usage === "number" ? data.usage : 0,
      limit: typeof data.limit === "number" ? data.limit : null,
    };
  });
}
