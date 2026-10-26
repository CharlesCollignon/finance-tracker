import "server-only";

import { isoDateInAppTimeZone } from "@finance/core/constants";
import {
  RECEIPT_SCHEMA,
  receiptFromReading,
  receiptKind,
  type ReceiptReading,
} from "@finance/core/receipts";
import { readSource, type ReadSourceOptions } from "@/lib/ai/read-source";
import { writerFor, type Writer } from "@/lib/ai/writer";
import { scanWriter } from "@/lib/statements/scan";

/**
 * A receipt read by the person's own AI account, at their word: the shop,
 * the day, the total — three things copied off the picture, which the
 * person then applies to the row or not. The same writer a statement's
 * scan uses — Mistral, on Mistral's EU servers, whatever model they chose
 * for the rest — for the same reason: the file is theirs, and the owner
 * chose Mistral in the EU for pictures of their money. Sent once, for this
 * reading, and kept nowhere here.
 */

/** A receipt's three lines, with room for a long one. */
const MAX_TOKENS = 400;

/** Within the minute a request is given. */
const TIMEOUT_MS = 45_000;

function systemPrompt(today: string): string {
  return [
    "You read a shop receipt, an invoice or a payment confirmation from a picture or a PDF, and copy three things off it.",
    `Today is ${today}.`,
    "merchant: the shop's or the issuer's name as printed, and nothing else — no address, no slogan.",
    "date: the day of the payment, YYYY-MM-DD, only when printed; a day without its year is this year's unless that is after today.",
    "total: the total actually paid, a point before the cents, no sign and no currency. Never a subtotal, a tax line, a tip line or a change line.",
    "Never invent, round or complete: what is not printed is null.",
    "receipt is false when the document is none of these; the rest is then null.",
  ].join("\n");
}

export type ReceiptReadResult =
  | { reading: ReceiptReading }
  | { error: string };

function errorOf(failure: string | null): string {
  switch (failure) {
    case "busy":
      return "statements.scanBusy";
    case "refused":
      return "statements.scanRefused";
    case "no-credit":
      return "statements.scanNoCredit";
    default:
      return "transaction.receiptReadFailed";
  }
}

export async function readReceipt(
  userId: string,
  bytes: Uint8Array,
  options: ReadSourceOptions & { writer?: Writer | null } = {},
): Promise<ReceiptReadResult> {
  const writer =
    options.writer === undefined ? await writerFor(userId) : options.writer;
  if (!writer) {
    return { error: "transaction.receiptNoAccount" };
  }
  const kind = receiptKind(bytes);
  if (!kind) {
    return { error: "transaction.receiptKind" };
  }
  const data = `data:${kind.type};base64,${Buffer.from(bytes).toString("base64")}`;
  const today = isoDateInAppTimeZone(new Date());

  const source = readSource(
    {
      responseFormat: () => ({
        type: "json_schema",
        json_schema: { name: "receipt", strict: true, schema: RECEIPT_SCHEMA },
      }),
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
      logPrefix: "receipt-read",
    },
    scanWriter(writer),
    options,
  );
  const answer = await source.write({
    system: systemPrompt(today),
    user: [
      { type: "text", text: "Read this receipt." },
      kind.kind === "pdf"
        ? { type: "file", file: { filename: "receipt.pdf", file_data: data } }
        : { type: "image_url", image_url: { url: data } },
    ],
    locale: "fr",
  });
  if (answer === null) {
    return { error: errorOf(source.failure()) };
  }
  const reading = receiptFromReading(answer, today);
  return reading ? { reading } : { error: "transaction.receiptReadNothing" };
}
