import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { AiCreditState } from "@finance/core/ai-models";

import { notifyDataChanged } from "@/lib/data-version";
import { callWebApi, webApiAvailable } from "@/lib/web-api";

/**
 * Connecting the user's AI account from the phone
 * (docs/plans/AI_ACCOUNT_PLAN.md, Phase 3).
 *
 * The web server holds the key and always will, so the phone only starts the
 * round trip and watches it end. It asks the server for OpenRouter's address
 * with its bearer, opens it in a browser session, and OpenRouter's callback —
 * on the server — sends that browser to `pluclair://profile?ai=<outcome>`,
 * which closes the session with that address. The connection was written by
 * the callback, out of the phone's sight, so a success is announced here.
 */

/** Where the callback sends the browser back to; the session closes on it. */
const RETURN_URL = "pluclair://profile";

export type AiConnectResult =
  | { outcome: "connected" | "refused" | "expired" | "cancelled" }
  | { error: string };

export async function connectAiAccount(): Promise<AiConnectResult> {
  if (!webApiAvailable()) {
    return { error: "aiAccount.unavailable" };
  }
  const started = await callWebApi<{ url: string }>(
    "/api/ai/openrouter/start",
    { body: { mode: "app" }, timeoutMs: 20_000 },
  );
  if (!started.ok) {
    return { error: started.error };
  }

  const session = await WebBrowser.openAuthSessionAsync(
    started.url,
    RETURN_URL,
  );
  if (session.type !== "success" || !session.url) {
    // Closed before OpenRouter answered. The round trip's state lapses on
    // the server by itself.
    return { outcome: "cancelled" };
  }
  const ai = Linking.parse(session.url).queryParams?.ai;
  const outcome = ai === "connected" || ai === "refused" ? ai : "expired";
  if (outcome === "connected") {
    notifyDataChanged("reads", "positions", "preferences");
  }
  return { outcome };
}

/** What the connected account's key has spent and may spend. */
export async function getAiCredit(): Promise<AiCreditState> {
  const result = await callWebApi<AiCreditState>("/api/ai/connection", {
    method: "GET",
    timeoutMs: 20_000,
  });
  if (!result.ok) {
    return { state: "unknown" };
  }
  return result.state === "ok"
    ? { state: "ok", credit: result.credit }
    : { state: result.state };
}
