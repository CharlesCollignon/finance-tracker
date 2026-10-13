import type { BankTransaction } from "../bank-feed";
import type { BankId } from "./banks";
import type { StatementCheck } from "./check";

/**
 * What a bank's file says, once read: the lines of each account it covers,
 * in the very shape the bank connection's lines arrive in
 * (`BankTransaction`), so that an export goes through the feed's own
 * matcher and inbox (`planFeed`) — known charges filed, the rest « À
 * vérifier » — as if the bank had sent it.
 *
 * Pure: bytes in, lines out. Who the lines belong to, and what is already
 * in the ledger, is the data layer's to say.
 */

/** The kinds of file a statement can come in, as read from its content. */
export type StatementFormat =
  | "csv"
  | "ofx"
  | "qif"
  | "camt"
  | "mt940"
  | "cfonb"
  | "html"
  | "xlsx"
  | "ods"
  /** A bank's alert e-mails, read as lines (`mail.ts`). */
  | "email"
  /** Read elsewhere: a PDF statement, an old binary Excel, an image. */
  | "pdf"
  | "xls"
  | "image"
  | "unknown";

/** The account a block of lines is on, as far as the file says. */
export interface StatementAccount {
  /** Without spaces, upper case. */
  iban: string | null;
  /** The bank's own account number, when the file gives no IBAN. */
  number: string | null;
  /** The file's name for the account (« COMPTE CHEQUE »), when it has one. */
  name: string | null;
}

/** A balance the file states: signed, as a decimal string. */
export interface StatementBalance {
  date: string | null;
  amount: string;
}

/** One account's lines, and what the file says around them. */
export interface StatementBlock {
  account: StatementAccount | null;
  /** ISO 4217. */
  currency: string;
  /** The period covered: the file's own, or else its lines' first and last days. */
  from: string | null;
  to: string | null;
  opening: StatementBalance | null;
  closing: StatementBalance | null;
  /**
   * Each line with its `id`: stable from one download to the next, so the
   * same export, or two that overlap, add nothing twice (`line-ids.ts`).
   */
  lines: BankTransaction[];
  /**
   * True when every amount is positive and nothing in the file says which
   * way any of them went: a list of expenses written without their minus.
   * The import asks once rather than guessing a salary into a cost.
   */
  signUnknown: boolean;
  /**
   * Whether the lines add up to the statement's own balances or totals
   * (`check.ts`); absent or null when it states none to hold them to.
   */
  check?: StatementCheck | null;
}

/** Why a file gave no lines. */
export type StatementProblem =
  /** Nothing in it. */
  | "empty"
  /** A PDF, an old Excel or an image: not read on the device. */
  | "notHere"
  /** A PDF with no text in it — a scan — or an image: for the AI, if the person agrees. */
  | "scanned"
  /** A PDF locked by a password of its own. */
  | "locked"
  /** A table whose columns could not be told apart: the user maps them. */
  | "columns"
  /** Neither a table nor any format known here. */
  | "unreadable";

export interface Statement {
  format: StatementFormat;
  /** The bank the file comes from, when it says so plainly enough. */
  bank: BankId | null;
  blocks: StatementBlock[];
  /** Rows that looked like data but could not be read: said, not dropped. */
  skipped: number;
  problem: StatementProblem | null;
  /**
   * The rows as read, when the columns could not be told apart
   * (`problem: "columns"`), for the import's fallback mapping.
   */
  table: string[][] | null;
  /**
   * Read by the person's AI account (`scan.ts`) rather than from the file's
   * own text: every line then waits in « À vérifier ».
   */
  readByAi?: boolean;
}

/** A line before its id: what a reader produces. */
export type RawLine = Omit<BankTransaction, "id">;

/** The account fields, empty. */
export const NO_ACCOUNT: StatementAccount = {
  iban: null,
  number: null,
  name: null,
};
