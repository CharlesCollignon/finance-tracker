"use server";

import { firstIssue, type ActionResult } from "@finance/core/action-result";
import { statementImportSchema } from "@finance/core/validations/statements";
import { getOwner } from "@/lib/owner";
import { revalidateApp } from "@/lib/revalidate-paths";
import type { StatementOutcome } from "@finance/core/validations/statements";
import { planStatement, undoStatement } from "@/lib/statements/service";
import { createClient } from "@/lib/supabase/server";

/**
 * A statement brought on the web: what it would do (`previewStatement`),
 * doing it (`importStatement`), and taking it back (`undoStatementImport`)
 * — for the money on screen, the person's or their space's. The lines were
 * read in the browser; the bank feed's own planner decides them here
 * (`lib/statements/service.ts`).
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
