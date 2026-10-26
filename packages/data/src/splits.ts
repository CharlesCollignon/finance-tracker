import type { ActionResult } from "@finance/core/action-result";
import { firstIssue } from "@finance/core/action-result";
import { newUuid } from "@finance/core/uuid";
import { splitSchema, type SplitInput } from "@finance/core/validations/splits";

import type { Db } from "./client";
import { dbError } from "./errors";

/**
 * One payment in several parts, and back (migration 079), for both apps.
 *
 * A split keeps the row it was made from — its id, its day, the bank line
 * that may point at it — as its first part, and writes the others beside
 * it, every part carrying one `split_group`. Every figure already counts
 * rows, so nothing else changes: the month, the category and the shop each
 * see their part. « Réunir » puts the amounts back into the first row and
 * takes the others away.
 */

/** Whether two amounts are the same money, to the cent. */
function same(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

export async function splitTransaction(
  db: Db,
  ownerId: string,
  input: SplitInput,
): Promise<ActionResult<{ ids: string[] }>> {
  const parsed = splitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const { id, parts } = parsed.data;

  const { data: row, error: readError } = await db
    .from("transactions")
    .select("id, amount, occurred_on, cash_on, note, split_group")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (readError) {
    return { error: dbError(readError) };
  }
  if (!row) {
    return { error: "actions.entryNoLongerHere" };
  }

  const total = parts.reduce((sum, part) => sum + part.amount, 0);
  if (!same(total, Number(row.amount))) {
    return { error: "transaction.splitMustSum" };
  }

  const group = row.split_group ?? newUuid();
  const [first, ...rest] = parts;

  const { error: updateError } = await db
    .from("transactions")
    .update({
      amount: first!.amount,
      category_id: first!.categoryId,
      note: first!.note ?? row.note,
      split_group: group,
    })
    .eq("id", id)
    .eq("user_id", ownerId);
  if (updateError) {
    return { error: dbError(updateError) };
  }

  const { data: inserted, error: insertError } = await db
    .from("transactions")
    .insert(
      rest.map((part) => ({
        user_id: ownerId,
        category_id: part.categoryId,
        amount: part.amount,
        occurred_on: row.occurred_on,
        cash_on: row.cash_on,
        note: part.note ?? row.note,
        split_group: group,
      })),
    )
    .select("id");
  if (insertError) {
    // The first part is the row as it was, less the others: put it back.
    await db
      .from("transactions")
      .update({ amount: row.amount, split_group: row.split_group })
      .eq("id", id)
      .eq("user_id", ownerId);
    return { error: dbError(insertError) };
  }

  return {
    success: true,
    message: "transaction.splitDone",
    ids: [id, ...(inserted ?? []).map((part) => part.id)],
  };
}

/**
 * The parts of a split, oldest first — the row it was made from leads.
 */
export async function readSplitParts(
  db: Db,
  ownerId: string,
  group: string,
): Promise<{ id: string; amount: number; categoryId: string; note: string | null }[]> {
  const { data, error } = await db
    .from("transactions")
    .select("id, amount, category_id, note, created_at")
    .eq("user_id", ownerId)
    .eq("split_group", group)
    .order("created_at", { ascending: true })
    .order("id");
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    categoryId: row.category_id,
    note: row.note,
  }));
}

/**
 * Put a split back into one row: the amounts into the first part, the
 * others taken away. Not a delete the person could take back — a split
 * can be made again.
 */
export async function unsplitTransaction(
  db: Db,
  ownerId: string,
  id: string,
): Promise<ActionResult> {
  const { data: row, error: readError } = await db
    .from("transactions")
    .select("split_group")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (readError) {
    return { error: dbError(readError) };
  }
  if (!row?.split_group) {
    return { error: "actions.entryNoLongerHere" };
  }
  const parts = await readSplitParts(db, ownerId, row.split_group);
  const [first, ...rest] = parts;
  if (!first) {
    return { error: "actions.entryNoLongerHere" };
  }
  const total = parts.reduce((sum, part) => sum + part.amount, 0);

  const { error: updateError } = await db
    .from("transactions")
    .update({ amount: Math.round(total * 100) / 100, split_group: null })
    .eq("id", first.id)
    .eq("user_id", ownerId);
  if (updateError) {
    return { error: dbError(updateError) };
  }
  if (rest.length > 0) {
    const { error: deleteError } = await db
      .from("transactions")
      .delete()
      .eq("user_id", ownerId)
      .in(
        "id",
        rest.map((part) => part.id),
      );
    if (deleteError) {
      return { error: dbError(deleteError) };
    }
  }
  return { success: true, message: "transaction.unsplitDone" };
}

/** The receipt behind a row: its path in the bucket, or none. */
export async function setReceipt(
  db: Db,
  ownerId: string,
  id: string,
  path: string | null,
): Promise<ActionResult> {
  const { error } = await db
    .from("transactions")
    .update({ receipt_path: path })
    .eq("id", id)
    .eq("user_id", ownerId);
  return error ? { error: dbError(error) } : { success: true };
}

/** The receipt's path, for a signed link, a reading or its removal. */
export async function readReceiptPath(
  db: Db,
  ownerId: string,
  id: string,
): Promise<string | null> {
  const { data } = await db
    .from("transactions")
    .select("receipt_path")
    .eq("id", id)
    .eq("user_id", ownerId)
    .maybeSingle();
  return data?.receipt_path ?? null;
}
