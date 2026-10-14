import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "@finance/core/action-result";
import { withDirection, type Statement } from "@finance/core/statement";
import type { Database } from "@finance/core/types/database";
import {
  STATEMENT_MAIL_DOMAIN,
  type StatementImportInput,
  type StatementOutcome,
} from "@finance/core/validations/statements";
import {
  readMailItems,
  readStatementInbox,
  type InboxView,
} from "@finance/data/statements";
import { createAdminClient } from "@/lib/supabase/admin";
import { planStatement } from "./service";

/**
 * A person's address for their bank's e-mails (migration 075): made, paused,
 * changed, and what waits from it imported or set aside — each at the
 * person's request, the route having said who they are. Written with the
 * service role, which alone writes these tables; every write names them.
 */

type Client = SupabaseClient<Database>;

/** Whether e-mails can be received here: the inbound service's signing key is set. */
export function mailInAvailable(): boolean {
  return Boolean(process.env.MAILGUN_WEBHOOK_SIGNING_KEY);
}

export async function inboxView(db: Client, userId: string): Promise<InboxView> {
  if (!mailInAvailable()) {
    return { available: false, address: null, inbox: null, items: [] };
  }
  const [inbox, items] = await Promise.all([
    readStatementInbox(db, userId),
    readMailItems(db, userId),
  ]);
  return {
    available: true,
    address: inbox ? `${inbox.token}@${STATEMENT_MAIL_DOMAIN}` : null,
    inbox,
    items,
  };
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Twelve letters and digits, drawn evenly: the address's own part. */
function newToken(): string {
  let token = "";
  while (token.length < 12) {
    for (const byte of randomBytes(24)) {
      // 252 is the largest multiple of 36 below 256: no letter favoured.
      if (byte < 252 && token.length < 12) {
        token += ALPHABET[byte % 36];
      }
    }
  }
  return token;
}

function admin(): Client | null {
  return mailInAvailable() ? createAdminClient() : null;
}

/** The address made, or switched back on. */
export async function startInbox(userId: string): Promise<ActionResult> {
  const db = admin();
  if (!db) {
    return { error: "statements.mailUnavailable" };
  }
  const { data } = await db
    .from("statement_inboxes")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    const { error } = await db
      .from("statement_inboxes")
      .update({ enabled: true })
      .eq("user_id", userId);
    return error ? { error: "errors.couldNotSave" } : { success: true };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await db
      .from("statement_inboxes")
      .insert({ user_id: userId, token: newToken() });
    if (!error) {
      return { success: true };
    }
  }
  return { error: "errors.couldNotSave" };
}

/** E-mails no longer read; the address kept, to switch back on. */
export async function stopInbox(userId: string): Promise<ActionResult> {
  const db = admin();
  if (!db) {
    return { error: "statements.mailUnavailable" };
  }
  const { error } = await db
    .from("statement_inboxes")
    .update({ enabled: false })
    .eq("user_id", userId);
  return error ? { error: "errors.couldNotSave" } : { success: true };
}

/** A new address: the old one reaches no one from now on. */
export async function renewInbox(userId: string): Promise<ActionResult> {
  const db = admin();
  if (!db) {
    return { error: "statements.mailUnavailable" };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await db
      .from("statement_inboxes")
      .update({
        token: newToken(),
        enabled: true,
        forward_code: null,
        forward_link: null,
        forward_code_at: null,
      })
      .eq("user_id", userId);
    if (!error) {
      return { success: true };
    }
  }
  return { error: "errors.couldNotSave" };
}

/**
 * What waited from an e-mail, imported to the account the person said —
 * its lines read from what was kept, not from the request. Alerts are
 * provisional lines, and the account becomes the one their alerts go to.
 */
export async function importMailItem(
  userId: string,
  itemId: string,
  choice: { account: StatementImportInput["account"]; direction: "out" | "in" },
): Promise<ActionResult<StatementOutcome & { importId: string | null }>> {
  const db = admin();
  if (!db) {
    return { error: "statements.mailUnavailable" };
  }
  const { data: item } = await db
    .from("statement_mail_items")
    .select("id, kind, format, bank, file_name, statement")
    .eq("id", itemId)
    .eq("user_id", userId)
    .eq("status", "waiting")
    .maybeSingle();
  const statement = item?.statement as unknown as Statement | undefined;
  const block = statement?.blocks[0];
  if (!item || !statement || !block) {
    return { error: "errors.notFound" };
  }
  const lines = (block.signUnknown ? withDirection(block, choice.direction) : block).lines;
  const format = item.format as StatementImportInput["format"];

  // The account's owner: the person, or their space for a joint account.
  let ownerId = userId;
  if (choice.account.kind === "existing") {
    const { data: account } = await db
      .from("bank_accounts")
      .select("space_id")
      .eq("user_id", userId)
      .eq("provider_account_id", choice.account.providerAccountId)
      .maybeSingle();
    ownerId = account?.space_id ?? userId;
  }
  const result = await planStatement(
    db,
    { userId, ownerId },
    {
      account: choice.account,
      lines: lines as StatementImportInput["lines"],
      format,
      bank: item.bank,
      fileName: item.file_name,
      from: block.from,
      to: block.to,
      closing: block.closing,
      source: "email",
    },
    { write: true, provisional: item.kind === "alerts" },
  );
  if (!result.success) {
    return { error: result.error };
  }
  await db
    .from("statement_mail_items")
    .update({ status: "imported", decided_at: new Date().toISOString() })
    .eq("id", item.id);
  const { data: inbox } = await db
    .from("statement_inboxes")
    .select("lines_brought")
    .eq("user_id", userId)
    .maybeSingle();
  if (inbox) {
    await db
      .from("statement_inboxes")
      .update({
        lines_brought: inbox.lines_brought + result.matched + result.filed + result.waiting,
        // Their next alerts go where these went.
        ...(item.kind === "alerts" ? { alert_account: result.providerAccountId } : {}),
      })
      .eq("user_id", userId);
  }
  return result;
}

/** What waited, set aside: nothing of it is imported. */
export async function dismissMailItem(userId: string, itemId: string): Promise<ActionResult> {
  const db = admin();
  if (!db) {
    return { error: "statements.mailUnavailable" };
  }
  const { error } = await db
    .from("statement_mail_items")
    .update({ status: "dismissed", decided_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", userId)
    .eq("status", "waiting");
  return error ? { error: "errors.couldNotSave" } : { success: true };
}
