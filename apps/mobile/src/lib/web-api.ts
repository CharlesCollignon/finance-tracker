import { announcingFetch } from "@/lib/data-version";
import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * A call to one of the web app's `/api/bank/*` routes, as the signed-in user.
 *
 * The same arrangement `refreshFromBank` uses: the phone holds no bank
 * credentials and never will, so everything that needs them — connecting,
 * importing, disconnecting — is asked of the web server with the Supabase
 * access token as a bearer, and row level security applies there exactly as
 * it does here.
 *
 * Never throws. A route's own `{ error }` comes back as-is (it is a message
 * key or a sentence a screen may show, so pass it through `resolveMessage`);
 * a server that could not be reached comes back as `bankConnect.unreachable`,
 * so every caller has one shape to handle.
 */

export type WebResult<T> =
  | ({ ok: true; status: number } & T)
  | { ok: false; status: number; error: string };

/** Whether this build has a web app to ask at all. */
export function webApiAvailable(): boolean {
  return WEB_APP_URL !== null;
}

const UNREACHABLE = "bankConnect.unreachable";

export async function callWebApi<T extends object>(
  path: string,
  {
    method = "POST",
    body,
    timeoutMs = 70_000,
  }: {
    method?: "GET" | "POST";
    body?: unknown;
    /** Longer than the route's own `maxDuration`, so its answer wins. */
    timeoutMs?: number;
  } = {},
): Promise<WebResult<T>> {
  if (!WEB_APP_URL) {
    return { ok: false, status: 0, error: "bankConnect.unavailable" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { ok: false, status: 401, error: "errors.notAuthenticated" };
  }

  // Explicit rather than AbortSignal.timeout, for the reason bank-refresh
  // gives: a build without it would hang rather than fail.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Announcing: what a route wrote reaches every screen that reads it.
    const response = await announcingFetch(`${WEB_APP_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const parsed = (await response.json().catch(() => null)) as
      (T & { error?: string }) | null;

    if (!response.ok || !parsed || typeof parsed.error === "string") {
      return {
        ok: false,
        status: response.status,
        error: typeof parsed?.error === "string" ? parsed.error : UNREACHABLE,
      };
    }
    return { ok: true, status: response.status, ...parsed };
  } catch {
    return { ok: false, status: 0, error: UNREACHABLE };
  } finally {
    clearTimeout(timer);
  }
}
