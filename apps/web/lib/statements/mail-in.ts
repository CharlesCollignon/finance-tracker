import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  alertOf,
  forwardingConfirmation,
  mailText,
  messageLineId,
  readStatementFile,
  statementKey,
  type MailAlert,
  type Statement,
  type StatementBlock,
} from "@finance/core/statement";
import type { Database } from "@finance/core/types/database";
import {
  STATEMENT_MAIL_DOMAIN,
  type StatementImportInput,
} from "@finance/core/validations/statements";
import { readPdfStatement } from "./pdf";
import { planStatement } from "./service";

/**
 * An e-mail that came to someone's Pluclair address, read and let go of
 * (`docs/plans/STATEMENTS_PLAN.md`, Phase 4): a mail service's forwarding
 * code, shown to the person; a statement attached, imported to its account
 * — or kept read, waiting for them to say which account when it is a new
 * one; a bank's alert, a line on the account its alerts go to. Nothing of
 * the e-mail is kept: not its words, not its attachments. An e-mail that
 * holds none of these is counted, and dropped.
 *
 * Runs for the webhook, with the service role: every read and write names
 * the person the address belongs to.
 */

type Client = SupabaseClient<Database>;

export interface InboundAttachment {
  name: string;
  type: string;
  size: number;
  /** Fetched only when read. */
  bytes: () => Promise<Uint8Array | null>;
}

/** An e-mail as the inbound service hands it over (`mailgun.ts`). */
export interface InboundMail {
  /** The message's own id: the same e-mail delivered twice is one. */
  id: string;
  recipients: string[];
  from: string;
  subject: string;
  text: string;
  html: string | null;
  /** `YYYY-MM-DD`, in the app's time zone. */
  receivedOn: string;
  attachments: InboundAttachment[];
}

export type MailOutcome = "unknown" | "off" | "confirmation" | "read" | "ignored";

/** A statement bigger than this is not one. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ADDRESS = new RegExp(
  `^([a-z0-9]{12})(?:\\+[^@]*)?@${STATEMENT_MAIL_DOMAIN.replace(/\./g, "\\.")}$`,
  "i",
);

/** The address's token, among the e-mail's recipients. */
function tokenOf(recipients: readonly string[]): string | null {
  for (const recipient of recipients) {
    const match = ADDRESS.exec(recipient.trim());
    if (match) {
      return match[1]!.toLowerCase();
    }
  }
  return null;
}

/** The file account a statement key names, and whose money it is. */
async function accountByKey(
  db: Client,
  userId: string,
  key: string,
): Promise<{ providerAccountId: string; ownerId: string } | null> {
  const { data } = await db
    .from("bank_accounts")
    .select("provider_account_id, space_id")
    .eq("user_id", userId)
    .eq("source", "file")
    .eq("statement_key", key)
    .maybeSingle();
  return data
    ? { providerAccountId: data.provider_account_id, ownerId: data.space_id ?? userId }
    : null;
}

/** A read statement or alerts, kept for the person to say which account. */
async function wait(
  db: Client,
  userId: string,
  kind: "statement" | "alerts",
  statement: Statement,
  fileName: string | null,
): Promise<void> {
  await db.from("statement_mail_items").insert({
    user_id: userId,
    kind,
    format: statement.format,
    bank: statement.bank,
    file_name: fileName?.slice(0, 200) || null,
    statement: statement as unknown as Database["public"]["Tables"]["statement_mail_items"]["Insert"]["statement"],
  });
}

/** One account's part of an attached statement: imported, or waiting. */
async function takeStatement(
  db: Client,
  userId: string,
  statement: Statement,
  block: StatementBlock,
  fileName: string,
): Promise<number> {
  const key = statementKey(block.account);
  const known = key ? await accountByKey(db, userId, key) : null;
  if (!known || block.signUnknown || statement.format === "unknown" || statement.format === "xls") {
    await wait(db, userId, "statement", { ...statement, blocks: [block] }, fileName);
    return 0;
  }
  const input: StatementImportInput = {
    account: { kind: "existing", providerAccountId: known.providerAccountId },
    lines: block.lines as StatementImportInput["lines"],
    format: statement.format === "image" ? "pdf" : statement.format,
    bank: statement.bank,
    fileName: fileName.slice(0, 200) || null,
    from: block.from,
    to: block.to,
    closing: block.closing,
    source: "email",
  };
  const result = await planStatement(
    db,
    { userId, ownerId: known.ownerId },
    input,
    { write: true },
  );
  return result.success ? result.matched + result.filed + result.waiting : 0;
}

/**
 * Where a bank's alerts go: the account the person chose for them; else
 * the one file account whose number ends as the alert says; else their
 * only current account. Null when it is theirs to say.
 */
async function alertAccount(
  db: Client,
  userId: string,
  chosen: string | null,
  tail: string | null,
): Promise<{ providerAccountId: string; ownerId: string } | null> {
  const { data } = await db
    .from("bank_accounts")
    .select("provider_account_id, statement_key, role, space_id")
    .eq("user_id", userId)
    .eq("source", "file");
  const accounts = data ?? [];
  const pick = (row: (typeof accounts)[number]) => ({
    providerAccountId: row.provider_account_id,
    ownerId: row.space_id ?? userId,
  });
  const mine = accounts.find((row) => row.provider_account_id === chosen);
  if (mine) {
    return pick(mine);
  }
  const byTail = tail ? accounts.filter((row) => row.statement_key?.endsWith(tail)) : [];
  if (byTail.length === 1) {
    return pick(byTail[0]!);
  }
  const current = accounts.filter((row) => row.role === "spending" || row.role === "joint");
  return current.length === 1 ? pick(current[0]!) : null;
}

/** A bank's alert: a provisional line on its account, or one more waiting. */
async function takeAlert(
  db: Client,
  userId: string,
  chosen: string | null,
  alert: MailAlert,
  messageId: string,
): Promise<number> {
  const line = { ...alert.line, id: messageLineId(alert.line, messageId) };
  const account = await alertAccount(db, userId, chosen, alert.tail);
  if (account) {
    const result = await planStatement(
      db,
      { userId, ownerId: account.ownerId },
      {
        account: { kind: "existing", providerAccountId: account.providerAccountId },
        lines: [line] as StatementImportInput["lines"],
        format: "email",
        bank: alert.bank,
        fileName: null,
        from: line.bookingDate,
        to: line.bookingDate,
        closing: null,
        source: "email",
      },
      { write: true, provisional: true },
    );
    return result.success ? result.matched + result.filed + result.waiting : 0;
  }

  // Alerts for an account not said yet gather in one waiting item.
  const { data: waiting } = await db
    .from("statement_mail_items")
    .select("id, statement")
    .eq("user_id", userId)
    .eq("kind", "alerts")
    .eq("status", "waiting")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const held = waiting?.statement as unknown as Statement | undefined;
  const block = held?.blocks[0];
  if (waiting && block) {
    if (!block.lines.some((one) => one.id === line.id)) {
      const lines = [...block.lines, line];
      const days = lines.map((one) => one.bookingDate ?? "").filter(Boolean).sort();
      await db
        .from("statement_mail_items")
        .update({
          statement: {
            ...held,
            blocks: [{ ...block, lines, from: days[0] ?? null, to: days[days.length - 1] ?? null }],
          } as unknown as Database["public"]["Tables"]["statement_mail_items"]["Update"]["statement"],
        })
        .eq("id", waiting.id);
    }
    return 0;
  }
  await wait(
    db,
    userId,
    "alerts",
    {
      format: "email",
      bank: alert.bank,
      blocks: [
        {
          account: null,
          currency: "EUR",
          from: line.bookingDate,
          to: line.bookingDate,
          opening: null,
          closing: null,
          lines: [line],
          signUnknown: false,
        },
      ],
      skipped: 0,
      problem: null,
      table: null,
    },
    null,
  );
  return 0;
}

/** One e-mail, received: what it was, and its lines where they belong. */
export async function receiveMail(db: Client, mail: InboundMail): Promise<MailOutcome> {
  const token = tokenOf(mail.recipients);
  if (!token) {
    return "unknown";
  }
  const { data: inbox } = await db
    .from("statement_inboxes")
    .select("user_id, enabled, alert_account, mails_read, mails_ignored, lines_brought")
    .eq("token", token)
    .maybeSingle();
  if (!inbox) {
    return "unknown";
  }
  if (!inbox.enabled) {
    return "off";
  }
  const text = mail.text.trim() ? mail.text : mail.html ? mailText(mail.html) : "";
  const now = new Date().toISOString();

  const confirmation = forwardingConfirmation({ from: mail.from, subject: mail.subject, text });
  if (confirmation) {
    await db
      .from("statement_inboxes")
      .update({
        forward_code: confirmation.code,
        forward_link: confirmation.link?.slice(0, 600) ?? null,
        forward_code_at: now,
        last_mail_at: now,
      })
      .eq("user_id", inbox.user_id);
    return "confirmation";
  }

  let read = false;
  let brought = 0;
  for (const attachment of mail.attachments) {
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      continue;
    }
    const bytes = await attachment.bytes();
    if (!bytes || bytes.length > MAX_ATTACHMENT_BYTES) {
      continue;
    }
    let statement = readStatementFile(bytes);
    // A picture is read by the person's AI at their word only, never here.
    if (statement.format === "image" || statement.format === "xls") {
      continue;
    }
    if (statement.format === "pdf") {
      statement = await readPdfStatement(bytes);
    }
    if (statement.blocks.length === 0) {
      continue;
    }
    read = true;
    for (const block of statement.blocks) {
      brought += await takeStatement(db, inbox.user_id, statement, block, attachment.name);
    }
  }

  if (!read) {
    const alert = alertOf({ from: mail.from, subject: mail.subject, text, receivedOn: mail.receivedOn });
    if (alert) {
      read = true;
      brought += await takeAlert(db, inbox.user_id, inbox.alert_account, alert, mail.id);
    }
  }

  await db
    .from("statement_inboxes")
    .update({
      last_mail_at: now,
      mails_read: inbox.mails_read + (read ? 1 : 0),
      mails_ignored: inbox.mails_ignored + (read ? 0 : 1),
      lines_brought: inbox.lines_brought + brought,
    })
    .eq("user_id", inbox.user_id);
  return read ? "read" : "ignored";
}
