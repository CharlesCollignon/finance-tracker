/**
 * What a statement import sends to the server: the lines the device read
 * from the file (`@finance/core/statement`), the account they are on, and
 * what the file was. Checked again on the server — the lines are the
 * person's own, but the shape is not taken on trust.
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const words = z.string().max(500);

/** One line, as `BankTransaction`, with the id `line-ids.ts` gives it. */
export const statementLineSchema = z.object({
  id: z.string().regex(/^l[0-9a-f]{16}-\d{1,6}$/),
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  creditDebitIndicator: z.enum(["CRDT", "DBIT"]),
  bookingDate: isoDate,
  valueDate: isoDate.nullable(),
  transactionDate: isoDate.nullable(),
  creditorName: words.nullable(),
  creditorIban: z.string().max(40).nullable(),
  debtorName: words.nullable(),
  debtorIban: z.string().max(40).nullable(),
  remittanceInformation: words.nullable(),
  merchantCategoryCode: z.string().max(4).nullable(),
  balanceAfterTransaction: z
    .string()
    .regex(/^-?\d{1,10}(\.\d{1,2})?$/)
    .nullable()
    .optional(),
});

/** The account the lines are on: one known already, or one met now. */
export const statementAccountSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("existing"),
    providerAccountId: z.string().min(1).max(200),
  }),
  z.object({
    kind: z.literal("new"),
    /** IBAN or number, when the file gave one (`statementKey`). */
    key: z.string().min(5).max(40).nullable(),
    label: z.string().trim().min(1).max(80),
    bank: z.string().max(40).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    role: z.enum(["spending", "savings", "ignored"]),
  }),
]);

export const statementImportSchema = z.object({
  account: statementAccountSchema,
  lines: z.array(statementLineSchema).max(5000),
  format: z.enum([
    "csv",
    "ofx",
    "qif",
    "camt",
    "mt940",
    "cfonb",
    "html",
    "xlsx",
    "ods",
    "pdf",
    "image",
    // A bank's alert e-mails, read as lines (`alertOf`).
    "email",
    // A bank app's notifications on the phone (`notificationAlert`).
    "notification",
  ]),
  bank: z.string().max(40).nullable(),
  fileName: z.string().max(200).nullable(),
  from: isoDate.nullable(),
  to: isoDate.nullable(),
  /** The balance the file states at its end, signed. */
  closing: z
    .object({
      date: isoDate.nullable(),
      amount: z.string().regex(/^-?\d{1,10}(\.\d{1,2})?$/),
    })
    .nullable(),
  source: z.enum(["file", "paste", "share", "email", "notification"]),
  /**
   * Read by the person's AI account off a picture or a scan: every line
   * then waits in « À vérifier », nothing filed unasked.
   */
  readByAi: z.boolean().optional(),
});

export type StatementImportInput = z.infer<typeof statementImportSchema>;

/**
 * The most a statement sent to the server to be read — a PDF, a picture —
 * may weigh: under the four and a half megabytes a request may carry, once
 * written out for the phone's request (a third more).
 */
export const MAX_SENT_FILE_BYTES = 3_300_000;

/** What an import does, or would do: the server's answer to both apps. */
export interface StatementOutcome {
  /** Lines in the file. */
  total: number;
  /** Already brought by an earlier import of this account. */
  known: number;
  /** Paired with a row the ledger already holds. */
  matched: number;
  /** Filed on their own: a merchant answered for, a code that says. */
  filed: number;
  /** Waiting in « À vérifier ». */
  waiting: number;
  /**
   * Of those, the ones the ledger seems to hold already — typed by hand, or
   * written by a charge — offered there to pair rather than paired unasked:
   * a wrong silent merge loses a real purchase.
   */
  likelyTyped: number;
  /** Left out: a transfer between the person's own accounts, a zero. */
  left: number;
  /** For an Épargne or « Ne pas suivre » account, nothing goes in the Journal. */
  kept: boolean;
}

/** Where a person's bank e-mails go: `<token>@` this (migration 075). */
export const STATEMENT_MAIL_DOMAIN = "releves.pluclair.com";
