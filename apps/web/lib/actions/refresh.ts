"use server";

import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { autoCloseMonths } from "@/lib/bank/auto-close";
import { bankFeedConfigured } from "@/lib/bank/client";
import type { PullFreshness } from "@finance/core/bank-pull";
import { readPullFreshness } from "@/lib/bank/pull";
import { syncBankFeed } from "@/lib/bank/sync";
import { revalidateEverySurface } from "@/lib/revalidate-paths";

/**
 * Bring everything up to date, from wherever the user happens to be.
 *
 * The refresh used to live on the Ledger, inside the bank inbox, which is
 * where the rows land but not where the question gets asked. "Is that
 * transfer in yet" is asked while looking at the month, and having to
 * navigate to another surface to find out is the sort of friction that
 * teaches people the number on screen cannot be trusted.
 *
 * Attended by definition — somebody pressed it — which is the kind of access
 * PSD2 does not cap. The unattended run has an allowance and spends it in
 * `api/cron/refresh`; this does not touch that allowance.
 *
 * Deliberately not the same work as the cron. Repricing walks every user's
 * templates and quotes them against the market, which is a slow job that
 * belongs on a schedule and would make a button feel broken.
 */
export interface RefreshResult {
  error?: string;
  success?: boolean;
  message?: string;
  /** How old the data is now, for the control that triggered this. */
  freshness?: PullFreshness;
}

export async function refreshEverythingAction(): Promise<RefreshResult> {
  const user = await getAuthUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const supabase = await createClient();

  // Without a connection there is nothing outside the database to reconcile
  // with, so a refresh is a re-read. Worth having anyway: another device may
  // have added something, and the button should not be missing on a screen
  // just because this deployment has no bank wired up.
  if (!bankFeedConfigured()) {
    revalidateEverySurface();
    return { success: true, message: "Up to date" };
  }

  try {
    const outcome = await syncBankFeed(supabase, user.id, { pull: "attended" });
    const closes = await autoCloseMonths(supabase, user.id);

    revalidateEverySurface();

    const parts: string[] = [];

    if (outcome.pull && !outcome.pull.pulled && outcome.pull.why) {
      // The refusal is the message. Reporting "nothing new" after a cooldown
      // refusal would be a claim about the bank we have not earned.
      return {
        success: true,
        message: outcome.pull.why,
        freshness: await readPullFreshness(supabase, user.id),
      };
    }

    if (outcome.imported > 0) {
      parts.push(`${outcome.imported} added`);
    }
    if (outcome.pending > 0) {
      parts.push(`${outcome.pending} to review`);
    }
    if (closes.closed.length > 0) {
      parts.push(
        `${closes.closed.length} ${
          closes.closed.length === 1 ? "month" : "months"
        } closed`,
      );
    }
    if (outcome.needReconnect > 0) {
      parts.push(
        `${outcome.needReconnect} ${
          outcome.needReconnect === 1 ? "account needs" : "accounts need"
        } reconnecting`,
      );
    }

    return {
      success: true,
      message: parts.length > 0 ? parts.join(", ") : "Nothing new",
      freshness: await readPullFreshness(supabase, user.id),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not reach the bank.",
    };
  }
}
