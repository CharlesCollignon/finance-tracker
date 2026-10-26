"use server";

import type { ActionResult } from "@finance/core/action-result";
import {
  RECEIPT_MAX_BYTES,
  receiptKind,
  receiptPath,
  type ReceiptReading,
} from "@finance/core/receipts";
import * as ledger from "@finance/data/ledger";
import { readReceiptPath, setReceipt } from "@finance/data/splits";
import { asOwner } from "@/lib/actions/as-user";
import { readReceipt } from "@/lib/receipts/read";

/**
 * The receipt behind a row (migration 079): attached, opened, read and
 * removed through the person's own session, so the bucket's policies hold
 * — a file goes under the owner's folder and nowhere else.
 */

const BUCKET = "receipts";

export async function attachReceipt(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "errors.invalidInput" };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { error: "transaction.receiptTooBig" };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = receiptKind(bytes);
  if (!kind) {
    return { error: "transaction.receiptKind" };
  }
  return asOwner(async (db, ownerId): Promise<ActionResult> => {
    const before = await readReceiptPath(db, ownerId, id);
    const path = receiptPath(ownerId, id, kind.extension);
    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: kind.type, upsert: true });
    if (error) {
      return { error: "errors.couldNotSave" };
    }
    const result = await setReceipt(db, ownerId, id, path);
    if (!result.success) {
      return result;
    }
    if (before && before !== path) {
      await db.storage.from(BUCKET).remove([before]);
    }
    return { success: true, message: "transaction.receiptAttached" };
  });
}

export async function removeReceipt(id: string): Promise<ActionResult> {
  return asOwner(async (db, ownerId): Promise<ActionResult> => {
    const path = await readReceiptPath(db, ownerId, id);
    if (path) {
      await db.storage.from(BUCKET).remove([path]);
    }
    const result = await setReceipt(db, ownerId, id, null);
    return result.success
      ? { success: true, message: "transaction.receiptRemoved" }
      : result;
  });
}

/** A link to the file, good for a few minutes. */
export async function receiptUrl(
  id: string,
): Promise<ActionResult<{ url: string }>> {
  return asOwner<{ url: string }>(
    async (db, ownerId): Promise<ActionResult<{ url: string }>> => {
      const path = await readReceiptPath(db, ownerId, id);
      if (!path) {
        return { error: "actions.entryNoLongerHere" };
      }
      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(path, 300);
      if (error || !data) {
        return { error: "errors.couldNotSave" };
      }
      return { success: true, url: data.signedUrl };
    },
    { redraw: "never" },
  );
}

/** The shop, the day and the total, read off the file by the person's AI account. */
export async function readReceiptAction(
  id: string,
): Promise<ActionResult<{ reading: ReceiptReading }>> {
  return asOwner<{ reading: ReceiptReading }>(
    async (
      db,
      ownerId,
      userId,
    ): Promise<ActionResult<{ reading: ReceiptReading }>> => {
      const path = await readReceiptPath(db, ownerId, id);
      if (!path) {
        return { error: "actions.entryNoLongerHere" };
      }
      const { data, error } = await db.storage.from(BUCKET).download(path);
      if (error || !data) {
        return { error: "transaction.receiptReadFailed" };
      }
      const result = await readReceipt(
        userId,
        new Uint8Array(await data.arrayBuffer()),
      );
      return "error" in result
        ? { error: result.error }
        : { success: true, reading: result.reading };
    },
    { redraw: "never" },
  );
}

/** What was read, applied to the row: only what the receipt said. */
export async function applyReceiptReading(
  id: string,
  reading: ReceiptReading,
): Promise<ActionResult> {
  return asOwner(async (db, ownerId): Promise<ActionResult> => {
    const { data: row } = await db
      .from("transactions")
      .select("category_id, amount, occurred_on, note")
      .eq("id", id)
      .eq("user_id", ownerId)
      .maybeSingle();
    if (!row) {
      return { error: "actions.entryNoLongerHere" };
    }
    const result = await ledger.updateTransaction(db, ownerId, {
      id,
      categoryId: row.category_id,
      amount: reading.total ?? Number(row.amount),
      occurredOn: reading.date ?? row.occurred_on,
      note: reading.merchant ?? row.note ?? undefined,
    });
    return result.success
      ? { success: true, message: "transaction.receiptApplied" }
      : result;
  });
}
