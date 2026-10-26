import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import type { ActionResult } from "@finance/core/action-result";
import {
  RECEIPT_MAX_BYTES,
  receiptKind,
  receiptPath,
  type ReceiptReading,
} from "@finance/core/receipts";

import { setReceipt } from "@/lib/mutations";
import { ownerFor } from "@/lib/owner";
import { supabase } from "@/lib/supabase";
import { callWebApi } from "@/lib/web-api";

/**
 * The receipt behind a row, on the phone (migration 079): picked, put in
 * the `receipts` bucket under the owner's folder through the phone's own
 * session — the bucket's policies hold as the web's do — opened by a link
 * good for a few minutes, read on the person's AI account through the web
 * app (`/api/receipts`, where the model key is opened), and removed.
 */

const BUCKET = "receipts";

/** Bytes as base64, in pieces: a 10 MB string is too much for one call. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let start = 0; start < bytes.length; start += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  }
  return btoa(binary);
}

export type PickOutcome =
  | { canceled: true }
  | { error: string }
  | { bytes: Uint8Array };

/** A picture or a PDF from the phone, as bytes, the picker's copy removed. */
export async function pickReceipt(): Promise<PickOutcome> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) {
    return { canceled: true };
  }
  const asset = picked.assets[0];
  try {
    if ((asset.size ?? 0) > RECEIPT_MAX_BYTES) {
      return { error: "transaction.receiptTooBig" };
    }
    const bytes = new Uint8Array(await new File(asset.uri).arrayBuffer());
    if (bytes.length > RECEIPT_MAX_BYTES) {
      return { error: "transaction.receiptTooBig" };
    }
    return { bytes };
  } catch {
    return { error: "transaction.receiptKind" };
  } finally {
    try {
      new File(asset.uri).delete();
    } catch {
      // Already gone, or a file the provider does not let us delete.
    }
  }
}

/** Put the file in the bucket and on the row; the one before goes. */
export async function attachReceipt(
  userId: string,
  transactionId: string,
  before: string | null,
  bytes: Uint8Array,
): Promise<ActionResult> {
  const kind = receiptKind(bytes);
  if (!kind) {
    return { error: "transaction.receiptKind" };
  }
  const path = receiptPath(ownerFor(userId), transactionId, kind.extension);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: kind.type, upsert: true });
  if (error) {
    return { error: "errors.couldNotSave" };
  }
  const result = await setReceipt(transactionId, path);
  if (result.success && before && before !== path) {
    await supabase.storage.from(BUCKET).remove([before]);
  }
  return result.success
    ? { success: true, message: "transaction.receiptAttached" }
    : result;
}

export async function removeReceipt(
  transactionId: string,
  path: string,
): Promise<ActionResult> {
  await supabase.storage.from(BUCKET).remove([path]);
  const result = await setReceipt(transactionId, null);
  return result.success
    ? { success: true, message: "transaction.receiptRemoved" }
    : result;
}

/** A link to the file, good for a few minutes. */
export async function receiptUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

/** The shop, the day and the total, read off the file by the person's AI account. */
export async function readReceipt(
  path: string,
): Promise<{ reading: ReceiptReading } | { error: string }> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    return { error: "transaction.receiptReadFailed" };
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  const result = await callWebApi<{ reading?: ReceiptReading }>(
    "/api/receipts",
    { body: { action: "read", file: toBase64(bytes) }, timeoutMs: 65_000 },
  );
  if (!result.ok) {
    return { error: result.error };
  }
  return result.reading
    ? { reading: result.reading }
    : { error: "transaction.receiptReadNothing" };
}
