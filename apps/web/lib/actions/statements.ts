"use server";

import { firstIssue, type ActionResult } from "@finance/core/action-result";
import { readStatementFile, type Statement } from "@finance/core/statement";
import {
  MAX_SENT_FILE_BYTES,
  statementImportSchema,
} from "@finance/core/validations/statements";
import { getOwner } from "@/lib/owner";
import { revalidateApp } from "@/lib/revalidate-paths";
import type { StatementOutcome } from "@finance/core/validations/statements";
import { readPdfStatement } from "@/lib/statements/pdf";
import { scanStatement } from "@/lib/statements/scan";
import { planStatement, undoStatement } from "@/lib/statements/service";
import { createClient } from "@/lib/supabase/server";

/**
 * A statement brought on the web: what it would do (`previewStatement`),
 * doing it (`importStatement`), and taking it back (`undoStatementImport`)
 * — for the money on screen, the person's or their space's. The lines were
 * read in the browser; the bank feed's own planner decides them here
 * (`lib/statements/service.ts`). A PDF is read here (`readStatementPdf`),
 * and a picture or a scan by the person's AI account, when they say so
 * (`scanStatementFile`).
 */

type Outcome = ActionResult<StatementOutcome & { importId: string | null }>;

async function run(input: unknown, write: boolean): Promise<Outcome> {
  const owner = await getOwner();
  if (!owner) {
    return { error: "errors.notAuthenticated" };
  }
  const parsed = statementImportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const result = await planStatement(
    await createClient(),
    { userId: owner.userId, ownerId: owner.ownerId },
    parsed.data,
    { write },
  );
  if (write && result.success) {
    revalidateApp();
  }
  return result;
}

export async function previewStatement(input: unknown): Promise<Outcome> {
  return run(input, false);
}

export async function importStatement(input: unknown): Promise<Outcome> {
  return run(input, true);
}

export async function undoStatementImport(
  importId: string,
): Promise<ActionResult<{ removed: number }>> {
  const owner = await getOwner();
  if (!owner) {
    return { error: "errors.notAuthenticated" };
  }
  if (!/^[0-9a-f-]{36}$/.test(importId)) {
    return { error: "errors.invalidInput" };
  }
  const result = await undoStatement(
    await createClient(),
    owner.ownerId,
    importId,
  );
  if (result.success) {
    revalidateApp();
  }
  return result;
}

type Read = ActionResult<{ statement: Statement }>;

/** The file a form sent, when it is one the server reads. */
async function sentFile(
  form: FormData,
): Promise<{ bytes: Uint8Array; format: Statement["format"] } | { error: string }> {
  const file = form.get("file");
  if (!(file instanceof File)) {
    return { error: "errors.invalidInput" };
  }
  if (file.size > MAX_SENT_FILE_BYTES) {
    return { error: "statements.tooBigToSend" };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, format: readStatementFile(bytes).format };
}

/** A PDF statement, read from its text on the server. */
export async function readStatementPdf(form: FormData): Promise<Read> {
  if (!(await getOwner())) {
    return { error: "errors.notAuthenticated" };
  }
  const sent = await sentFile(form);
  if ("error" in sent) {
    return { error: sent.error };
  }
  if (sent.format !== "pdf") {
    return { error: "errors.invalidInput" };
  }
  return { success: true, statement: await readPdfStatement(sent.bytes) };
}

/**
 * A picture or a scanned PDF, read by the person's own AI account — asked
 * by the person, for this file, on the screen that says where it goes.
 */
export async function scanStatementFile(form: FormData): Promise<Read> {
  const owner = await getOwner();
  if (!owner) {
    return { error: "errors.notAuthenticated" };
  }
  const sent = await sentFile(form);
  if ("error" in sent) {
    return { error: sent.error };
  }
  if (sent.format !== "pdf" && sent.format !== "image") {
    return { error: "errors.invalidInput" };
  }
  const result = await scanStatement(owner.userId, sent.bytes, sent.format);
  return "error" in result
    ? { error: result.error }
    : { success: true, statement: result.statement };
}
