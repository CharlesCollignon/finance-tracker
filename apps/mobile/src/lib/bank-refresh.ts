import type { PullFreshness } from "@finance/core/bank-pull";

import { WEB_APP_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * Asking the bank, through the only thing that can.
 *
 * The open-banking credentials bundle is a decryption key. It lives in the
 * web server's environment and must never reach a phone, so the app cannot
 * talk to the provider itself — everything it shows comes straight out of
 * Supabase. Which meant pull-to-refresh could only ever re-read rows the
 * web app's cron had already fetched, and there was no way to be more current
 * than the last scheduled run.
 *
 * So the phone sends the Supabase access token it already holds to the web
 * app, which verifies it and does the fetch as that user. Every failure mode
 * here is soft: the caller reloads from Supabase either way, and the worst
 * outcome is figures that are as fresh as they were before.
 */

export interface BankRefreshOutcome {
  /** Whether the bank was actually asked. */
  pulled: boolean;
  /** What to tell the user, when there is something worth saying. */
  message: string | null;
  freshness: PullFreshness | null;
}

/** Long enough for a bank round trip, short enough not to hang a gesture. */
const TIMEOUT_MS = 45_000;

/** Whether asking the bank is possible at all on this build. */
export function bankRefreshAvailable(): boolean {
  return WEB_APP_URL !== null;
}

export async function refreshFromBank(): Promise<BankRefreshOutcome> {
  const quiet: BankRefreshOutcome = {
    pulled: false,
    message: null,
    freshness: null,
  };

  if (!WEB_APP_URL) {
    return quiet;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return quiet;
  }

  // AbortSignal.timeout is in Hermes on SDK 57, but a build without it would
  // hang the spinner rather than fail, so the controller is explicit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${WEB_APP_URL}/api/bank/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => null)) as {
      pulled?: boolean;
      message?: string;
      error?: string;
      freshness?: PullFreshness;
    } | null;

    if (!response.ok) {
      // Reported rather than thrown: the reload that follows is still worth
      // doing, and a screen that refuses to update because a bank was
      // unreachable is worse than one showing yesterday's statement.
      return {
        pulled: false,
        message: body?.error ?? "Could not reach your bank just now.",
        freshness: null,
      };
    }

    return {
      pulled: body?.pulled ?? false,
      message: body?.message ?? null,
      freshness: body?.freshness ?? null,
    };
  } catch {
    return {
      pulled: false,
      message: "Could not reach your bank just now.",
      freshness: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
