import type { ActionResult } from "@finance/core/action-result";
import { firstIssue } from "@finance/core/action-result";
import type { Locale } from "@finance/core/i18n/locale";
import {
  buildCategoryRenames,
  buildMissingCategorySeeds,
} from "@finance/core/seed-categories";
import type { Category } from "@finance/core/types/database";
import { categorySchema, parseUuid } from "@finance/core/validations/finance";
import type { z } from "zod";

import type { Db } from "./client";
import { markCategoryDeleted, type UndoToken } from "./deletions";
import { dbError } from "./errors";

/** A category to create or rename, as either app's form hands it over. */
export type CategoryChange = z.input<typeof categorySchema>;

/**
 * Postgres' wording for the two refusals a person can cause, as message
 * keys: a category still used by transactions cannot be deleted, and two
 * of the same name and kind cannot exist.
 */
function friendlyCategoryError(error: {
  code?: string;
  message?: string;
}): string {
  const message = error.message ?? "";
  if (error.code === "23503" || message.includes("foreign key")) {
    return "actions.categoryInUse";
  }
  if (error.code === "23505" || message.includes("duplicate key")) {
    return "actions.categoryExists";
  }
  return dbError(error);
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

  return error ? { error: friendlyCategoryError(error) } : { success: true };
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

  return error ? { error: dbError(error) } : { success: true };
}

export async function deleteCategory(
  db: Db,
  userId: string,
  id: string,
): Promise<ActionResult<{ undo: UndoToken }>> {
  if (!parseUuid(id)) {
    return { error: "errors.invalidInput" };
  }

  const marked = await markCategoryDeleted(db, userId, id);
  if (marked !== "unsupported") {
    return "error" in marked ? marked : { success: true, undo: marked.undo };
  }

  // Before migration 036: for good, with nothing to take back.
  const { error } = await db
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return error
    ? { error: friendlyCategoryError(error) }
    : { success: true, undo: null };
}

/** The user's categories, by type then name; archived ones only on request. */
export async function getCategories(
  db: Db,
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Category[]> {
  let query = db
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("type")
    .order("name");
  if (!includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data ?? [];
}

/**
 * Put the defaults a user has under their language's names — an account
 * seeded in English on a French app, or under a name a default no longer
 * has — at sign-in and when they change language. A name the user chose is
 * never touched. Returns how many were renamed.
 *
 * One rename failing (the name taken in between) leaves the rest done and
 * that category under the name it already had: not a reason to fail a
 * sign-in, which the phone's copy of this used to do.
 */
export async function renameDefaultCategories(
  db: Db,
  userId: string,
  locale: Locale,
): Promise<number> {
  const { data: existing, error } = await db
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
  return applyCategoryRenames(db, userId, existing ?? [], locale);
}

async function applyCategoryRenames(
  db: Db,
  userId: string,
  existing: { id: string; name: string; type: string }[],
  locale: Locale,
): Promise<number> {
  const renames = buildCategoryRenames(existing, locale);
  const results = await Promise.all(
    renames.map((rename) =>
      db
        .from("categories")
        .update({ name: rename.name })
        .eq("id", rename.id)
        .eq("user_id", userId),
    ),
  );
  const failed = results.filter((result) => result.error);
  if (failed.length > 0) {
    console.error("Category rename failed", failed[0]!.error!.code);
  }
  return renames.length - failed.length;
}

/**
 * Give a user every default they are missing, in their language, and name
 * the ones they have in it. Idempotent; run at each sign-in.
 */
export async function seedDefaultCategories(
  db: Db,
  userId: string,
  locale: Locale,
): Promise<void> {
  const { data: existing, error: existingError } = await db
    .from("categories")
    .select("id, name, type")
    .eq("user_id", userId);
  if (existingError) {
    throw existingError;
  }

  const missing = buildMissingCategorySeeds(userId, existing ?? [], locale);
  if (missing.length > 0) {
    const { error } = await db.from("categories").insert(missing);
    if (error) {
      throw error;
    }
  }

  await applyCategoryRenames(db, userId, existing ?? [], locale);
}
