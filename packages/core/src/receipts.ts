/**
 * « Justificatif »: the picture or the PDF behind a row, and what a reading
 * of it says.
 *
 * The file is a private object under the owner's folder in the `receipts`
 * bucket (migration 079); its path is on the row. A reading is the person's
 * own AI account copying three things off it — the shop, the day, the
 * total — which the person then applies to the row or not. Nothing here
 * is written on its own.
 */

/** Files a receipt may be, by their first bytes. */
export type ReceiptKind = "image" | "pdf";

/** The largest file a receipt may be: the bucket says the same. */
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export function receiptKind(
  bytes: Uint8Array,
): { kind: ReceiptKind; type: string; extension: string } | null {
  const starts = (signature: number[], at = 0) =>
    signature.every((byte, index) => bytes[at + index] === byte);
  if (starts([0x25, 0x50, 0x44, 0x46])) {
    return { kind: "pdf", type: "application/pdf", extension: "pdf" };
  }
  if (starts([0x89, 0x50, 0x4e, 0x47])) {
    return { kind: "image", type: "image/png", extension: "png" };
  }
  if (starts([0xff, 0xd8, 0xff])) {
    return { kind: "image", type: "image/jpeg", extension: "jpg" };
  }
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return { kind: "image", type: "image/webp", extension: "webp" };
  }
  return null;
}

/** Where a row's receipt lives: the owner's folder, the row's, the file. */
export function receiptPath(
  ownerId: string,
  transactionId: string,
  extension: string,
  stamp: number = Date.now(),
): string {
  return `${ownerId}/${transactionId}/${stamp}.${extension}`;
}

/** What the model answers with, and nothing else — the JSON schema it is held to. */
export const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["receipt", "merchant", "date", "total", "currency"],
  properties: {
    receipt: {
      type: "boolean",
      description:
        "True when the document is a shop receipt, an invoice or a payment confirmation.",
    },
    merchant: {
      type: ["string", "null"],
      description: "The shop's or the issuer's name as printed, nothing else.",
    },
    date: {
      type: ["string", "null"],
      description: "The day of the payment, YYYY-MM-DD, when printed.",
    },
    total: {
      type: ["string", "null"],
      description:
        "The total paid, a point before the cents, no sign, no currency: 12.30",
    },
    currency: { type: "string", description: "ISO 4217, EUR when not printed." },
  },
} as const;

export interface ReceiptReading {
  merchant: string | null;
  /** YYYY-MM-DD, never after today. */
  date: string | null;
  total: number | null;
  currency: string;
}

/**
 * What came back, checked: a reading of something that is no receipt is
 * nothing; a day after today, or one that is no day, is not a day; a total
 * that is not a positive amount is not a total.
 */
export function receiptFromReading(
  raw: unknown,
  today: string,
): ReceiptReading | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const answer = raw as Record<string, unknown>;
  if (answer.receipt !== true) {
    return null;
  }
  const merchant =
    typeof answer.merchant === "string" && answer.merchant.trim()
      ? answer.merchant.trim().slice(0, 200)
      : null;
  const date =
    typeof answer.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(answer.date) &&
    answer.date <= today
      ? answer.date
      : null;
  // « 12,30 », « 12.30 € » are a total; « -3 » is not one.
  const text =
    typeof answer.total === "string"
      ? answer.total.trim().replace(",", ".").replace(/[^\d.-]/g, "")
      : null;
  const parsedTotal =
    text !== null
      ? /^\d+(\.\d+)?$/.test(text)
        ? Number(text)
        : NaN
      : typeof answer.total === "number"
        ? answer.total
        : NaN;
  const total =
    Number.isFinite(parsedTotal) && parsedTotal > 0
      ? Math.round(parsedTotal * 100) / 100
      : null;
  const currency =
    typeof answer.currency === "string" && /^[A-Z]{3}$/.test(answer.currency)
      ? answer.currency
      : "EUR";
  if (merchant === null && date === null && total === null) {
    return null;
  }
  return { merchant, date, total, currency };
}
