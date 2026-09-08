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
  /**
   * Whether the attempt broke, as against being declined.
   *
   * Both come back with `pulled: false` and both are survivable, but they do
   * not deserve the same colour. "Your bank was asked moments ago" is the
   * cooldown working and the figures on screen are fine; a server that could
   * not be reached means nobody knows how current they are. Told apart here
   * because this is the only place that can still see the difference — by
   * the time a message is a string, a refusal and a 502 read alike.
   */
  failed: boolean;
  /** What to tell the user, when there is something worth saying. */
  message: string | null;
  freshness: PullFreshness | null;
}

/**
 * Deliberately longer than the route's own ceiling.
 *
 * `/api/bank/refresh` declares `maxDuration = 60`, so by sixty seconds the
 * server has answered one way or the other — with a result, or with its own
 * account of what went wrong. Giving up at forty-five turned a slow but
 * successful pull into "could not reach your bank" here while the server
 * finished the sync and recorded the pull, which is the one report worse than
 * a failure: an error for something that worked.
 *
 * So this waits the server out and lets the real answer win. It fires only
 * when nothing answers at all.
 */
const TIMEOUT_MS = 70_000;

/** Whether asking the bank is possible at all on this build. */
export function bankRefreshAvailable(): boolean {
  return WEB_APP_URL !== null;
}

export async function refreshFromBank(): Promise<BankRefreshOutcome> {
  // No bank ask is possible on this build, or nobody is signed in. Not a
  // failure and nothing to report: the caller's own re-read still happens.
  const quiet: BankRefreshOutcome = {
    pulled: false,
    failed: false,
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
        failed: true,
        message: body?.error ?? "Could not reach your bank just now.",
        freshness: null,
      };
    }

    return {
      pulled: body?.pulled ?? false,
      // A 200 is the server's considered answer, whatever it says. The
      // reasons it comes back unpulled — a cooldown, no bank connected, a
      // consent that has lapsed — are all reports rather than breakages.
      failed: false,
      message: body?.message ?? null,
      freshness: body?.freshness ?? null,
    };
  } catch {
    // Aborted at the timeout, offline, DNS, TLS. Nothing answered at all.
    return {
      pulled: false,
      failed: true,
      message: "Could not reach your bank just now.",
      freshness: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
