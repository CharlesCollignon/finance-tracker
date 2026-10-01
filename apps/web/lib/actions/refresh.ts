"use server";

import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { autoCloseMonths } from "@/lib/bank/auto-close";
import { bankFeedStatus, describeBankFeedStatus } from "@/lib/bank/client";
import { noteSyncFailure, noteSyncHealthy } from "@/lib/bank/health-note";
import type { PullFreshness } from "@finance/core/bank-pull";
import { readPullFreshness } from "@/lib/bank/pull";
import { syncBankFeed } from "@/lib/bank/sync";
import { revalidateApp } from "@/lib/revalidate-paths";
import { getLocale, getT } from "@/lib/locale";

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
    return { error: "errors.notAuthenticated" };
  }

  const supabase = await createClient();

  // Without a connection there is nothing outside the database to reconcile
  // with, so a refresh is a re-read. Worth having anyway: another device may
  // have added something, and the button should not be missing on a screen
  // just because this deployment has no bank wired up.
  //
  // What it must not do is report "Up to date", which is what it used to.
  // Nothing here asked a bank, so nothing here has earned a word about
  // whether the figures match one — the same reason the cooldown branch
  // below returns the refusal verbatim instead of "nothing new". And the
  // reasons a bank is missing are worth telling apart: an ended connection
  // or a paused wallet each have something the user can do about them.
  const status = await bankFeedStatus(user.id);
  if (status !== "connected") {
    revalidateApp();
    return { success: true, message: describeBankFeedStatus(status) };
  }

  try {
    const outcome = await syncBankFeed(supabase, user.id, { pull: "attended" });
    await noteSyncHealthy(user.id);
    const closes = await autoCloseMonths(supabase, user.id);

    revalidateApp();

    const parts: string[] = [];

    if (outcome.pull && !outcome.pull.pulled && outcome.pull.why) {
      // The refusal is the message. Reporting "nothing new" after a cooldown
      // refusal would be a claim about the bank we have not earned.
      return {
        success: true,
        message: outcome.pull.why,
        freshness: await readPullFreshness(
          supabase,
          user.id,
          await getLocale(),
        ),
      };
    }

    const t = await getT();
    if (outcome.imported > 0) {
      parts.push(t("actions.syncAdded", { count: outcome.imported }));
    }
    if (outcome.pending > 0) {
      parts.push(t("actions.syncToReview", { count: outcome.pending }));
    }
    if (closes.closed.length > 0) {
      parts.push(
        t("actions.syncMonthsClosed", { count: closes.closed.length }),
      );
    }
    if (outcome.needReconnect > 0) {
      parts.push(
        t("actions.syncNeedReconnect", { count: outcome.needReconnect }),
      );
    }

    return {
      success: true,
      message: parts.length > 0 ? parts.join(", ") : "actions.nothingNew",
      freshness: await readPullFreshness(supabase, user.id, await getLocale()),
    };
  } catch (error) {
    // The words, not the error: an SDK failure carries the API path it hit.
    return { error: (await noteSyncFailure(user.id, error)).message };
  }
}
