import { allRows } from "@finance/core/paging";
import type { Statement } from "@finance/core/statement";
import type { Db } from "./client";

/**
 * What both apps read of the statements a person brought (migration 074):
 * the accounts known from their files, the imports made, and whether any
 * line — the bank's or a statement's — waits in the inbox's tables. The
 * writes go through the server (`apps/web/lib/statements/service.ts`),
 * where the bank feed's own planner decides each line.
 */

/** An account known from its files, as the import's picker shows it. */
export interface FileAccount {
  providerAccountId: string;
  label: string;
  bank: string | null;
  /** IBAN or number, as the next file of this account will give it. */
  key: string | null;
  role: "spending" | "savings" | "ignored" | "joint" | null;
}

export async function readFileAccounts(
  db: Db,
  userId: string,
): Promise<FileAccount[]> {
  const { data, error } = await db
    .from("bank_accounts")
    .select("provider_account_id, label, bank_name, statement_key, role")
    .eq("user_id", userId)
    .eq("source", "file")
    .order("first_seen_at", { ascending: true });
  if (error) {
    return [];
  }
  return (data ?? []).map((row) => ({
    providerAccountId: row.provider_account_id,
    label: row.label,
    bank: row.bank_name ?? null,
    key: row.statement_key ?? null,
    role: row.role ?? null,
  }));
}

/** One import, as the list under the import shows it. */
export interface StatementImport {
  id: string;
  providerAccountId: string;
  format: string;
  bank: string | null;
  fileName: string | null;
  from: string | null;
  to: string | null;
  linesNew: number;
  linesKnown: number;
  linesFiled: number;
  linesWaiting: number;
  createdAt: string;
  undoneAt: string | null;
}

/** The latest imports, newest first. */
export async function readStatementImports(
  db: Db,
  ownerId: string,
  limit = 12,
): Promise<StatementImport[]> {
  const { data, error } = await db
    .from("statement_imports")
    .select(
      "id, provider_account_id, format, bank, file_name, period_from, period_to, lines_new, lines_known, lines_filed, lines_waiting, created_at, undone_at",
    )
    .eq("user_id", ownerId)
    // A bank's alerts, one line each, are no import to list or undo.
    .neq("format", "email")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    providerAccountId: row.provider_account_id,
    format: row.format,
    bank: row.bank,
    fileName: row.file_name,
    from: row.period_from,
    to: row.period_to,
    linesNew: row.lines_new,
    linesKnown: row.lines_known,
    linesFiled: row.lines_filed,
    linesWaiting: row.lines_waiting,
    createdAt: row.created_at,
    undoneAt: row.undone_at,
  }));
}

/**
 * Whether any line, the bank's or a statement's, has ever come in: what
 * decides whether the Journal shows its « À vérifier » inbox. Not
 * `hasBankFeed`, which asks whether the bank is the ledger's record.
 */
export async function hasFeedLines(db: Db, userId: string): Promise<boolean> {
  const { count } = await db
    .from("bank_feed_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

/** The lines dated in one month, for « Fiabilité du mois ». */
export interface FeedCoverage {
  /** Every line of the month, the bank's or a statement's, whatever became of it. */
  lines: number;
  /** The last day a line reached, ISO; null when there is none. */
  lastDay: string | null;
  /** The month's lines still waiting in « À vérifier ». */
  pending: number;
}

export const NO_COVERAGE: FeedCoverage = { lines: 0, lastDay: null, pending: 0 };

/**
 * How far the lines reach into a month, and what waits there: what Le point
 * says the month's figures rest on (`@finance/core/month-trust`). Days and
 * statuses only, so a busy month is a small read.
 */
export async function readFeedCoverage(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<FeedCoverage> {
  const rows = await allRows(
    (start, end) =>
      db
        .from("bank_feed_items")
        .select("occurred_on, status")
        .eq("user_id", userId)
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("occurred_on", { ascending: false })
        .order("id")
        .range(start, end),
    { max: 3000 },
  ).catch(() => null);
  if (!rows) {
    return NO_COVERAGE;
  }
  return {
    lines: rows.length,
    lastDay: rows[0]?.occurred_on ?? null,
    pending: rows.filter((row) => row.status === "pending").length,
  };
}

/**
 * The person's address for their bank's e-mails (migration 075): whether it
 * is on, what has come, and a mail service's forwarding confirmation while
 * it is fresh — the code Gmail sends before it forwards anything.
 */
export interface StatementInbox {
  token: string;
  enabled: boolean;
  /** The account alert e-mails go to, once the person has said. */
  alertAccount: string | null;
  lastMailAt: string | null;
  mailsRead: number;
  mailsIgnored: number;
  linesBrought: number;
  forwardCode: string | null;
  forwardLink: string | null;
  forwardCodeAt: string | null;
}

export async function readStatementInbox(
  db: Db,
  userId: string,
): Promise<StatementInbox | null> {
  const { data, error } = await db
    .from("statement_inboxes")
    .select(
      "token, enabled, alert_account, last_mail_at, mails_read, mails_ignored, lines_brought, forward_code, forward_link, forward_code_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    token: data.token,
    enabled: data.enabled,
    alertAccount: data.alert_account,
    lastMailAt: data.last_mail_at,
    mailsRead: data.mails_read,
    mailsIgnored: data.mails_ignored,
    linesBrought: data.lines_brought,
    forwardCode: data.forward_code,
    forwardLink: data.forward_link,
    forwardCodeAt: data.forward_code_at,
  };
}

/**
 * A statement or alerts that came by e-mail for an account not known yet:
 * read, and waiting for the person to say which account.
 */
export interface MailItem {
  id: string;
  kind: "statement" | "alerts";
  format: string;
  bank: string | null;
  fileName: string | null;
  receivedAt: string;
  statement: Statement;
}

/** What waits from e-mails, newest first. */
export async function readMailItems(db: Db, userId: string): Promise<MailItem[]> {
  const { data, error } = await db
    .from("statement_mail_items")
    .select("id, kind, format, bank, file_name, received_at, statement")
    .eq("user_id", userId)
    .eq("status", "waiting")
    .order("received_at", { ascending: false })
    .limit(20);
  if (error) {
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind === "alerts" ? "alerts" : "statement",
    format: row.format,
    bank: row.bank,
    fileName: row.file_name,
    receivedAt: row.received_at,
    statement: row.statement as unknown as Statement,
  }));
}

/** What the import shows of the e-mail way in, as the server answers it. */
export interface InboxView {
  /** Whether an inbound-mail service is set up at all. */
  available: boolean;
  address: string | null;
  inbox: StatementInbox | null;
  items: MailItem[];
}
