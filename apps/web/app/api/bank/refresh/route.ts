import { autoCloseMonths } from "@/lib/bank/auto-close";
import { bankFeedStatus, describeBankFeedStatus } from "@/lib/bank/client";
import { noteSyncFailure, noteSyncHealthy } from "@/lib/bank/health-note";
import { readPullFreshness } from "@/lib/bank/pull";
import { syncBankFeed } from "@/lib/bank/sync";
import { sessionFromBearer } from "@/lib/supabase/bearer";
import { getLocale, getT } from "@/lib/locale";

/**
 * Asking the bank, for a client that cannot ask it directly.
 *
 * The credentials bundle is a decryption key. It lives in the server's
 * environment and must never reach a browser or a phone, so the mobile app
 * has no way to reach the provider itself — everything it shows comes
 * straight out of Supabase, and until this existed its pull-to-refresh could
 * only ever re-read rows the web app's cron had already fetched.
 *
 * This is the one thing the phone genuinely needs a server for. It presents
 * the Supabase access token it already holds; the token is verified and every
 * query below goes out carrying it, so row level security applies exactly as
 * it does for a cookie session. The service role is deliberately not used: an
 * endpoint a phone can reach must not be able to read anyone but its caller.
 *
 * Attended by definition — somebody pulled a list down — which is the kind of
 * access PSD2 does not cap. The cooldown still applies, and a refusal comes
 * back as a 200 with a reason: the statement the app already holds is still
 * perfectly readable, so this is not an error the client should retry.
 */

// One network-bound walk. The bank fetch is the slow part and sixty seconds
// is the ceiling a Hobby function gets anyway.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// No CORS headers on purpose. A native client is not subject to them, and
// adding them would open this to any web origin that has a token.

export async function POST(request: Request) {
  const session = await sessionFromBearer(request);
  if (!session) {
    return Response.json({ error: "errors.notAuthenticated" }, { status: 401 });
  }

  const status = await bankFeedStatus(session.userId);
  if (status !== "connected") {
    // Nothing outside the database to reconcile with. Not an error: the
    // client's own re-read is still the right thing to do. Asked per user,
    // because a deployment holding someone else's credentials has no bank to
    // offer this caller either — and said in those words, because "No bank
    // is connected" to the owner of a bundle whose user id does not match is
    // a dead end rather than a report.
    return Response.json({
      pulled: false,
      message: describeBankFeedStatus(status),
    });
  }

  // `backfill` is the review's "Fetch everything": the whole statement rather
  // than the recent window, as the web's `syncBankFeedAction(true)` asks. A
  // plain pull-to-refresh sends no body at all.
  const body = (await request.json().catch(() => ({}))) as {
    backfill?: unknown;
  };

  try {
    const outcome = await syncBankFeed(session.supabase, session.userId, {
      backfill: body.backfill === true,
      pull: "attended",
    });
    await noteSyncHealthy(session.userId);
    const closes = await autoCloseMonths(session.supabase, session.userId);

    if (outcome.pull && !outcome.pull.pulled && outcome.pull.why) {
      return Response.json({
        pulled: false,
        message: outcome.pull.why,
        freshness: await readPullFreshness(
          session.supabase,
          session.userId,
          await getLocale(),
        ),
      });
    }

    const parts: string[] = [];
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

    return Response.json({
      pulled: true,
      imported: outcome.imported,
      pending: outcome.pending,
      monthsClosed: closes.closed.length,
      message: parts.length > 0 ? parts.join(", ") : "actions.nothingNew",
      freshness: await readPullFreshness(
        session.supabase,
        session.userId,
        await getLocale(),
      ),
    });
  } catch (error) {
    // The words, not the error: an SDK failure carries the API path it hit.
    return Response.json(
      { error: (await noteSyncFailure(session.userId, error)).message },
      { status: 502 },
    );
  }
}
