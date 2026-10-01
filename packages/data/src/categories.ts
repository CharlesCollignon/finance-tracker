import type { ActionResult } from "@finance/core/action-result";
import { firstIssue } from "@finance/core/action-result";
import { categorySchema, parseUuid } from "@finance/core/validations/finance";
import type { z } from "zod";

import type { Db } from "./client";

/** A category to create or rename, as either app's form hands it over. */
export type CategoryChange = z.input<typeof categorySchema>;

/**
 * Postgres' wording for the two refusals a person can cause, as message
 * keys: a category still used by transactions cannot be deleted, and two
 * of the same name and kind cannot exist.
 */
function friendlyCategoryError(message: string): string {
  if (message.includes("foreign key")) {
    return "actions.categoryInUse";
  }
  if (message.includes("duplicate key")) {
    return "actions.categoryExists";
  }
  return message;
}

export async function upsertCategory(
  db: Db,
  userId: string,
  input: CategoryChange,
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const payload = {
    name: parsed.data.name,
    type: parsed.data.type,
    icon: parsed.data.icon ?? null,
    counts_toward_summary: parsed.data.countsTowardSummary ?? true,
  };

  const { error } = parsed.data.id
    ? await db
        .from("categories")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("user_id", userId)
    : await db.from("categories").insert({ user_id: userId, ...payload });

  return error
    ? { error: friendlyCategoryError(error.message) }
    : { success: true };
}

/** Archive a category, or bring it back: its history stays either way. */
export async function setCategoryArchived(
  db: Db,
  userId: string,
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  if (!parseUuid(id)) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db
    .from("categories")
    .update({ archived })
    .eq("id", id)
    .eq("user_id", userId);

  return error ? { error: error.message } : { success: true };
}

export async function deleteCategory(
  db: Db,
  userId: string,
  id: string,
): Promise<ActionResult> {
  if (!parseUuid(id)) {
    return { error: "errors.invalidInput" };
  }

  const { error } = await db
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return error
    ? { error: friendlyCategoryError(error.message) }
    : { success: true };
}
