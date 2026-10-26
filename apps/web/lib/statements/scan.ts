import "server-only";

import { isoDateInAppTimeZone } from "@finance/core/constants";
import {
  SCAN_SCHEMA,
  statementFromScan,
  type Statement,
} from "@finance/core/statement";
import { readSource, type ReadSourceOptions } from "@/lib/ai/read-source";
import { writerFor, type Writer } from "@/lib/ai/writer";

/**
 * A statement no text can be taken from — a scanned PDF, a photo, a
 * screenshot of the bank's app — read by the person's own AI account, with
 * their consent each time (`docs/plans/STATEMENTS_PLAN.md`, Phase 3).
 *
 * Pluclair holds no model key of its own (the owner's call, 2026-10-09), so
 * this is the person's OpenRouter account at work, as for their reads and
 * questions — but always with Mistral, on Mistral's EU servers (OpenRouter's
 * `mistral/eu` endpoint), whatever model they chose for the rest: the file
 * is a bank statement, and the owner chose Mistral, in the EU, for it
 * (question 2 of the plan). The file is sent once, for this reading, and
 * kept nowhere here; core checks what comes back (`statementFromScan`).
 */

/** The model that reads the picture: Mistral's, which reads images and PDFs. */
export const SCAN_MODEL = "mistralai/mistral-medium-3-5";

/** A long statement's lines, as `date|label|amount|balance`, with room. */
const MAX_TOKENS = 8000;

/** Within the minute a request is given, with room for the answer to travel. */
const TIMEOUT_MS = 55_000;

/** Pictures the model takes, by their first bytes. */
function imageType(bytes: Uint8Array): string | null {
  const starts = (signature: number[], at = 0) =>
    signature.every((byte, index) => bytes[at + index] === byte);
  if (starts([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

function systemPrompt(today: string): string {
  return [
    "You read a bank statement, or a list of bank account operations, from a document or a screenshot, and copy what it says.",
    `Today is ${today}.`,
    "Copy only what is printed. Never invent, round or complete a line, a date or an amount; leave out a line you cannot read in full.",
    "One line per operation that moved money. Leave out balances, totals, figures carried from one page to the next (« report », « à reporter »), headings, and operations pending, declined or cancelled (« en attente », « refusé », « annulé »).",
    "Write each line as date|label|amount|balance:",
    "- date: YYYY-MM-DD, the operation's own date (the first date column).",
    "- label: as printed, the words of all its rows joined by spaces, without any |.",
    "- amount: signed, a point before the cents. Negative for money out (the debit column, a minus sign, a card payment, a withdrawal, a direct debit); positive for money in (the credit column, a plus sign, a transfer received).",
    "- balance: the account's balance after the operation, signed, when printed; otherwise nothing.",
    "A day printed without its year takes the year of the statement's period. On a phone screenshot, « Aujourd'hui » is today, « Hier » is yesterday, and a day without a year is the most recent such day not after today.",
    "openingBalance and closingBalance: the balances printed at the start and at the end of the period, signed (a « débiteur » balance is negative); otherwise null.",
    "statement is false when the document is no bank statement and no list of bank operations; lines is then empty.",
  ].join("\n");
}

export type ScanResult = { statement: Statement } | { error: string };

/** Why no reading came back, for the person. */
function errorOf(failure: string | null): string {
  switch (failure) {
    case "busy":
      return "statements.scanBusy";
    case "refused":
      return "statements.scanRefused";
    case "no-credit":
      return "statements.scanNoCredit";
    default:
      return "statements.scanFailed";
  }
}

/** The person's writer, made to read a statement: Mistral, on Mistral's servers. */
export function scanWriter(writer: Writer): Writer {
  return {
    ...writer,
    model: SCAN_MODEL,
    temperature: 0,
    reasoning: false,
    extra: {
      provider: {
        // Mistral's EU endpoint and no other: busy there, the reading
        // fails and says so rather than going elsewhere.
        only: ["mistral/eu"],
        allow_fallbacks: false,
        require_parameters: true,
      },
    },
  };
}

/**
 * Read a picture or a scanned PDF as a statement, on `userId`'s own AI
 * account. The caller has the person's consent for this one file.
 */
export async function scanStatement(
  userId: string,
  bytes: Uint8Array,
  kind: "pdf" | "image",
  options: ReadSourceOptions & { writer?: Writer | null } = {},
): Promise<ScanResult> {
  const writer =
    options.writer === undefined ? await writerFor(userId) : options.writer;
  if (!writer) {
    return { error: "statements.scanNoAccount" };
  }
  const type = kind === "pdf" ? "application/pdf" : imageType(bytes);
  if (!type) {
    return { error: "statements.imageKind" };
  }
  const data = `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  const today = isoDateInAppTimeZone(new Date());

  const source = readSource(
    {
      responseFormat: () => ({
        type: "json_schema",
        json_schema: { name: "statement", strict: true, schema: SCAN_SCHEMA },
      }),
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
      logPrefix: "statement-scan",
    },
    scanWriter(writer),
    options,
  );
  const answer = await source.write({
    system: systemPrompt(today),
    user: [
      {
        type: "text",
        text:
          kind === "pdf"
            ? "Read this statement."
            : "Read the operations in this picture.",
      },
      kind === "pdf"
        ? { type: "file", file: { filename: "statement.pdf", file_data: data } }
        : { type: "image_url", image_url: { url: data } },
    ],
    locale: "fr",
  });
  if (answer === null) {
    return { error: errorOf(source.failure()) };
  }
  return { statement: statementFromScan(answer, { format: kind, today }) };
}
