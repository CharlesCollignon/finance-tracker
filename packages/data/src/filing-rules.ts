import type { ActionResult } from "@finance/core/action-result";
import { firstIssue } from "@finance/core/action-result";
import type { FilingRule } from "@finance/core/filing-rules";
import {
  filingRuleSchema,
  type FilingRuleInput,
} from "@finance/core/validations/filing-rules";

import type { Db } from "./client";
import { dbError } from "./errors";
import { isMissingSchema } from "./schema";

/**
 * The rules a person wrote for filing a line (migration 077), for both apps,
 * the sync and the import: read, written, counted. The matching is
 * `@finance/core/filing-rules`'s.
 *
 * Before migration 077 there is no table: reads answer with no rule, and a
 * write says the feature is not there yet.
 */

/** Postgres' wording for the one refusal a person can cause, as a key. */
function friendlyRuleError(error: { code?: string; message?: string }): string {
  if (error.code === "23505" || (error.message ?? "").includes("duplicate")) {
    return "rules.alreadyExists";
  }
  return dbError(error);
}

export async function readFilingRules(
  db: Db,
  ownerId: string,
): Promise<FilingRule[]> {
  const { data, error } = await db
    .from("filing_rules")
    .select(
      "id, words, category_id, direction, applied_count, created_from, categories!inner(name)",
    )
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    words: row.words,
    categoryId: row.category_id,
    categoryName: row.categories.name,
    direction: row.direction,
    appliedCount: row.applied_count,
    createdFrom: row.created_from,
  }));
}

export async function addFilingRule(
  db: Db,
  ownerId: string,
  input: FilingRuleInput,
): Promise<ActionResult<{ id: string; words: string }>> {
  const parsed = filingRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const { data, error } = await db
    .from("filing_rules")
    .insert({
      user_id: ownerId,
      words: parsed.data.words,
      category_id: parsed.data.categoryId,
      direction: parsed.data.direction,
      created_from: parsed.data.createdFrom ?? null,
    })
    .select("id, words")
    .single();
  if (error || !data) {
    return { error: error ? friendlyRuleError(error) : "errors.invalidInput" };
  }
  return { success: true, id: data.id, words: data.words, message: "rules.added" };
}

export async function updateFilingRule(
  db: Db,
  ownerId: string,
  id: string,
  input: FilingRuleInput,
): Promise<ActionResult> {
  const parsed = filingRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const { error } = await db
    .from("filing_rules")
    .update({
      words: parsed.data.words,
      category_id: parsed.data.categoryId,
      direction: parsed.data.direction,
    })
    .eq("id", id)
    .eq("user_id", ownerId);
  return error
    ? { error: friendlyRuleError(error) }
    : { success: true, message: "rules.saved" };
}

export async function deleteFilingRule(
  db: Db,
  ownerId: string,
  id: string,
): Promise<ActionResult> {
  const { error } = await db
    .from("filing_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);
  return error
    ? { error: dbError(error) }
    : { success: true, message: "rules.deleted" };
}

/**
 * Count what a sync or an import filed by rule: one call per rule, and
 * there are a handful. A failure costs the count and nothing else.
 */
export async function bumpFilingRules(
  db: Db,
  counts: ReadonlyMap<string, number>,
): Promise<void> {
  await Promise.all(
    [...counts].map(([rule, by]) =>
      by > 0
        ? db.rpc("bump_filing_rule", { rule, by }).then(() => undefined)
        : Promise.resolve(),
    ),
  );
}
