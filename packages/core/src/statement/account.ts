import { withLineIds } from "./line-ids";
import type { RawLine, StatementAccount, StatementBlock } from "./model";

/**
 * How a file's account is known again: its IBAN, or else the bank's own
 * number for it, as one string the next file of the same account gives too
 * (`bank_accounts.statement_key`, migration 074). Null when the file says
 * nothing of its account — the person then picks it, once.
 */
export function statementKey(
  account: StatementAccount | null | undefined,
): string | null {
  const raw = account?.iban ?? account?.number ?? null;
  const key = raw?.replace(/[\s.-]+/g, "").toUpperCase() ?? "";
  return key.length >= 5 ? key.slice(0, 40) : null;
}

/** « ••4821 »: enough of a number to recognise it, not enough to use it. */
export function accountTail(key: string | null | undefined): string | null {
  const clean = key?.replace(/\s+/g, "") ?? "";
  return clean.length >= 4 ? `••${clean.slice(-4)}` : null;
}

/**
 * A block whose amounts were all written without their sign, said by the
 * person to be money out (or in): every line turned that way, and given its
 * id again — the id holds the sign.
 */
export function withDirection(
  block: StatementBlock,
  direction: "out" | "in",
): StatementBlock {
  const raw: RawLine[] = block.lines.map(({ id: _id, ...line }) => ({
    ...line,
    creditDebitIndicator: direction === "out" ? "DBIT" : "CRDT",
    creditorName:
      direction === "out" ? (line.creditorName ?? line.debtorName) : null,
    debtorName:
      direction === "in" ? (line.debtorName ?? line.creditorName) : null,
  }));
  return { ...block, lines: withLineIds(raw), signUnknown: false };
}
