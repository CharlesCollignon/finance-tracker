import { autoCloseMonths } from "@/lib/bank/auto-close";
import { bankFeedConfigured } from "@/lib/bank/client";
import { readPullFreshness } from "@/lib/bank/pull";
import { syncBankFeed } from "@/lib/bank/sync";
import { sessionFromBearer } from "@/lib/supabase/bearer";

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
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!bankFeedConfigured()) {
    // Nothing outside the database to reconcile with. Not an error: the
    // client's own re-read is still the right thing to do.
    return Response.json({ pulled: false, message: "No bank is connected." });
  }

  try {
    const outcome = await syncBankFeed(session.supabase, session.userId, {
      pull: "attended",
    });
    const closes = await autoCloseMonths(session.supabase, session.userId);

    if (outcome.pull && !outcome.pull.pulled && outcome.pull.why) {
      return Response.json({
        pulled: false,
        message: outcome.pull.why,
        freshness: await readPullFreshness(session.supabase, session.userId),
      });
    }

    const parts: string[] = [];
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

    return Response.json({
      pulled: true,
      imported: outcome.imported,
      pending: outcome.pending,
      monthsClosed: closes.closed.length,
      message: parts.length > 0 ? parts.join(", ") : "Nothing new",
      freshness: await readPullFreshness(session.supabase, session.userId),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not reach the bank.",
      },
      { status: 502 },
    );
  }
}
