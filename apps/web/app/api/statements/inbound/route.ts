import { timingSafeEqual } from "node:crypto";
import { brevoMails } from "@/lib/statements/brevo";
import { mailInAvailable } from "@/lib/statements/inbox";
import { receiveMail, type MailOutcome } from "@/lib/statements/mail-in";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Where the inbound-mail service (Brevo) hands over each e-mail sent to a
 * `…@releves.pluclair.com` address (`docs/plans/STATEMENTS_PLAN.md`,
 * Phase 4). Brevo sends the secret it was given when the webhook was made
 * (`scripts/statement-inbox-setup.mjs`) in `x-pluclair-inbound`; nothing
 * else is read. Each e-mail is read and let go of (`lib/statements/mail-in.ts`);
 * the answer is a 200 whatever it held, so that nothing is sent twice for
 * a mail that simply was not a statement.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) {
    return false;
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.STATEMENT_INBOUND_SECRET;
  if (!mailInAvailable() || !secret) {
    return new Response("Not set up", { status: 404 });
  }
  if (!sameSecret(request.headers.get("x-pluclair-inbound"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createAdminClient();
  if (!db) {
    return new Response("Not set up", { status: 503 });
  }
  const mails = brevoMails(await request.json().catch(() => null));
  const outcomes: MailOutcome[] = [];
  for (const mail of mails) {
    try {
      outcomes.push(await receiveMail(db, mail));
    } catch (error) {
      // The outcome, never the mail: it is someone's bank's.
      console.warn(
        `[statement-inbound] an e-mail could not be read: ${error instanceof Error ? error.message : "unknown"}`,
      );
      outcomes.push("ignored");
    }
  }
  return Response.json({ received: outcomes.length, outcomes });
}
