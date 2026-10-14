import { mailInAvailable } from "@/lib/statements/inbox";
import { receiveMail } from "@/lib/statements/mail-in";
import { mailgunMail, mailgunSigned } from "@/lib/statements/mailgun";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Where the inbound-mail service (Mailgun, EU region) hands over each e-mail
 * sent to a `…@releves.pluclair.com` address (`docs/plans/STATEMENTS_PLAN.md`,
 * Phase 4), through the route `scripts/statement-inbox-setup.mjs` makes.
 * Nothing is read before Mailgun's signature is checked; then the e-mail is
 * read and let go of (`lib/statements/mail-in.ts`). The answer is a 200
 * whatever it held — Mailgun tries again for eight hours after anything
 * else — and a 406, which it does not retry, for a request that is no
 * e-mail at all.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const key = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!mailInAvailable() || !key) {
    return new Response("Not set up", { status: 404 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) {
    return new Response("Not an e-mail", { status: 406 });
  }
  if (!mailgunSigned(form, key)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = createAdminClient();
  if (!db) {
    return new Response("Not set up", { status: 503 });
  }
  try {
    const outcome = await receiveMail(db, mailgunMail(form));
    return Response.json({ outcome });
  } catch (error) {
    // The outcome, never the mail: it is someone's bank's.
    console.warn(
      `[statement-inbound] an e-mail could not be read: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return Response.json({ outcome: "ignored" });
  }
}
