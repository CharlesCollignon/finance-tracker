import { BANK_NAMES, type BankId } from "./banks";
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

/** Which of the person's accounts a block of lines goes to. */
export type AccountChoice =
  | { kind: "existing"; providerAccountId: string }
  | { kind: "new"; label: string; role: "spending" | "savings" | "ignored" };

/**
 * The account to start from: the one the file names, if it is known
 * already; for a file that names none, the person's only account, or their
 * only account at the file's bank (a bank's alert e-mails name no
 * account); otherwise a new one, named from the file — its own name for
 * the account, or its bank, or `mine` — and its last four digits, as a
 * current account.
 */
export function initialAccountChoice(
  block: Pick<StatementBlock, "account">,
  bank: BankId | null,
  accounts: readonly {
    providerAccountId: string;
    key: string | null;
    bank?: string | null;
  }[],
  mine: string,
): AccountChoice {
  const key = statementKey(block.account);
  const known = key
    ? accounts.find((account) => account.key === key)
    : undefined;
  if (known) {
    return { kind: "existing", providerAccountId: known.providerAccountId };
  }
  const sameBank = bank ? accounts.filter((account) => account.bank === bank) : [];
  const only = accounts.length === 1 ? accounts[0] : sameBank.length === 1 ? sameBank[0] : undefined;
  if (!key && only) {
    return { kind: "existing", providerAccountId: only.providerAccountId };
  }
  const name = block.account?.name ?? (bank ? BANK_NAMES[bank] : mine);
  return {
    kind: "new",
    label: [name, accountTail(key)].filter(Boolean).join(" ").slice(0, 80),
    role: "spending",
  };
}
