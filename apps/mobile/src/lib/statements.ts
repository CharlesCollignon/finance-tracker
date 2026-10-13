import type { Statement } from "@finance/core/statement";
import type {
  StatementImportInput,
  StatementOutcome,
} from "@finance/core/validations/statements";
import * as statements from "@finance/data/statements";

import { notifyDataChanged } from "@/lib/data-version";
import { supabase } from "@/lib/supabase";
import { callWebApi } from "@/lib/web-api";

/**
 * A bank statement brought on the phone (`docs/plans/STATEMENTS_PLAN.md`):
 * the file read here (`@finance/core/statement`), its lines decided and
 * written by the web, where the bank feed's planner runs
 * (`/api/statements`), exactly as the site's import does. What it reads —
 * the accounts known from earlier files, the latest imports — it reads
 * itself.
 *
 * A PDF is read on the server too, from its text (`readPdfOnServer`), and a
 * picture or a scan by the person's AI account when they ask
 * (`scanOnServer`): the file goes as base64, and comes back as lines.
 *
 * The route is not announced as a write (`ROUTE_AREAS`): a preview is
 * asked at every answer the person changes, and writes nothing. An import
 * or an undo says what it changed itself.
 */

export type Outcome = StatementOutcome & { importId: string | null };

export function readFileAccounts(userId: string) {
  return statements.readFileAccounts(supabase, userId);
}

export function readImports(ownerId: string) {
  return statements.readStatementImports(supabase, ownerId);
}

function ask<T extends object>(body: Record<string, unknown>) {
  return callWebApi<T>("/api/statements", { body, timeoutMs: 65_000 });
}

/** What importing would do, written nowhere. */
export async function previewStatement(
  input: StatementImportInput,
  ownerId: string,
): Promise<Outcome | null> {
  const result = await ask<Outcome>({ action: "preview", statement: input, owner: ownerId });
  return result.ok ? result : null;
}

export async function importStatement(
  input: StatementImportInput,
  ownerId: string,
): Promise<{ ok: true; outcome: Outcome } | { ok: false; error: string }> {
  const result = await ask<Outcome>({ action: "import", statement: input, owner: ownerId });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  notifyDataChanged("transactions", "bank");
  return { ok: true, outcome: result };
}

export async function undoStatementImport(
  importId: string,
  ownerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await ask<{ removed: number }>({ action: "undo", importId, owner: ownerId });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  notifyDataChanged("transactions", "bank");
  return { ok: true };
}

type Read = { ok: true; statement: Statement } | { ok: false; error: string };

/** A PDF statement, read by the server from its text. */
export async function readPdfOnServer(base64: string): Promise<Read> {
  const result = await ask<{ statement: Statement }>({ action: "readPdf", file: base64 });
  return result.ok ? { ok: true, statement: result.statement } : { ok: false, error: result.error };
}

/** A picture or a scanned PDF, read by the person's own AI account, at their word. */
export async function scanOnServer(base64: string): Promise<Read> {
  const result = await ask<{ statement: Statement }>({ action: "scan", file: base64 });
  return result.ok ? { ok: true, statement: result.statement } : { ok: false, error: result.error };
}
