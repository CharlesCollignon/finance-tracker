/**
 * What each bank account is to the user.
 *
 * One open-banking.io account can hold several banks, and each bank several
 * accounts: a current account, a Livret A, a joint account, a card. They are
 * not the same thing to a budget. A current account's movements are the
 * ledger and its balance is the money there is to spend; a Livret's balance
 * is savings, and its movements are the other side of transfers the current
 * account already recorded; a joint account or a card is followed elsewhere,
 * or not at all. So each account has a role, which the user confirms once,
 * and which nothing from that account is brought in before.
 */

import type { BankAccountRole } from "./types/database";

/** Whether an account's movements are brought into the ledger. */
export function followsMovements(
  role: BankAccountRole | null | undefined,
): boolean {
  return role === "spending";
}

/** An IBAN as two banks would both write it. */
function cleanIban(iban: string | null | undefined): string | null {
  const clean = iban?.replace(/\s+/g, "").toUpperCase();
  return clean ? clean : null;
}

/**
 * The IBANs a transfer between is the same money moving: the current
 * accounts', and only theirs. Money sent to the user's own Livret is set
 * aside, and is kept on the current account's side as savings; money sent to
 * an account nobody follows — a joint account — has left.
 */
export function ownTransferIbans(
  accounts: readonly {
    iban: string | null | undefined;
    role: BankAccountRole | null | undefined;
  }[],
): Set<string> {
  const ibans = new Set<string>();
  for (const account of accounts) {
    const iban = cleanIban(account.iban);
    if (iban && followsMovements(account.role)) {
      ibans.add(iban);
    }
  }
  return ibans;
}
