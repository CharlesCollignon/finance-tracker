/**
 * What each bank account is to the user, and the guess that pre-fills it.
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

import type {
  BankAccount,
  BankAccountRole,
  SavingsAccountKind,
} from "./types/database";

/** What the bank says about an account: its type and the names it gives. */
export interface BankAccountFacts {
  /**
   * The ISO 20022 cash account type, when the bank gives one: CACC for a
   * current account, SVGS for savings, CARD, LOAN…
   */
  accountType: string | null;
  /** Its product name, account name and display name, in any order. */
  names: readonly (string | null | undefined)[];
}

/** Types a bank gives a savings account. */
const SAVINGS_TYPES = new Set(["SVGS", "LLSV"]);
/** Types that are neither spending money nor a Livret: a card, a loan. */
const OTHER_TYPES = new Set(["CARD", "LOAN", "MGLD", "MOMA", "ODFT"]);

/** Lower case, accents gone, punctuation as spaces: how names are compared. */
function normalise(names: BankAccountFacts["names"]): string {
  return ` ${names
    .filter((name): name is string => Boolean(name))
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim()} `;
}

/**
 * An investment account a bank may show beside the others — the cash side
 * of a PEA, a PER, a life insurance contract. Their names say « épargne »,
 * and they are not a Livret: what is invested lives on Placements.
 */
const INVESTMENT =
  / (pea|per|perp|perin|cto) | actions | retraite | assurance | titres | bourse /;
/**
 * Never « crédit » alone: a display name may carry the bank's, and every
 * account at Crédit Agricole or Crédit Mutuel would read as a loan.
 */
const CARD_OR_LOAN =
  / (carte|card|cb|pret|loan|credit immobilier|credit renouvelable|credit conso) /;

/**
 * Which Livret an account is, from its names, or null when nothing says it
 * is one. Checked most precise first: « plan d'épargne logement » would
 * otherwise read as any savings.
 */
export function guessSavingsKind(
  names: BankAccountFacts["names"],
): SavingsAccountKind | null {
  const text = normalise(names);
  if (INVESTMENT.test(text)) {
    return null;
  }
  if (/ livret a | liv a | livret bleu /.test(text)) {
    return "livret_a";
  }
  if (/ ldds? | developpement durable /.test(text)) {
    return "ldds";
  }
  if (/ lep | epargne populaire /.test(text)) {
    return "lep";
  }
  if (/ pel | plan d? ?epargne logement /.test(text)) {
    return "pel";
  }
  if (/ cel | compte d? ?epargne logement /.test(text)) {
    return "cel";
  }
  if (/ livret | epargne | savings | csl /.test(text)) {
    return "livret";
  }
  return null;
}

/**
 * The role an account most likely has, to pre-fill the question — never to
 * answer it. The type the bank gives is trusted first, except that a name
 * saying Livret wins over a bank that files every account as current.
 */
export function guessAccountRole(facts: BankAccountFacts): BankAccountRole {
  const type = facts.accountType?.trim().toUpperCase() ?? "";
  if (OTHER_TYPES.has(type)) {
    return "ignored";
  }
  const text = normalise(facts.names);
  if (INVESTMENT.test(text)) {
    return "ignored";
  }
  if (SAVINGS_TYPES.has(type) || guessSavingsKind(facts.names) !== null) {
    return "savings";
  }
  if (CARD_OR_LOAN.test(text)) {
    return "ignored";
  }
  return "spending";
}

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

/** What the question about an account is pre-filled with. */
export interface AccountProposal {
  role: BankAccountRole;
  /** Which Livret it would feed as Épargne: guessed, else « Autre livret ». */
  savingsKind: SavingsAccountKind;
}

/**
 * The pre-filled answer for one account, from what its bank says: its type,
 * the product it is sold as, and its label — which may be a nickname or the
 * holder's name, so it comes last.
 */
export function proposeForAccount(
  account: Pick<BankAccount, "account_type" | "product" | "label">,
): AccountProposal {
  const names = [account.product, account.label];
  return {
    role: guessAccountRole({ accountType: account.account_type, names }),
    savingsKind: guessSavingsKind(names) ?? "livret",
  };
}

/**
 * The accounts waiting for the user to say what they are: readable, and
 * with no role. One whose consent lapsed waits too, but is not asked about:
 * nothing can be read from it, and asking would only be noise.
 */
export function awaitingRole<
  A extends Pick<BankAccount, "role" | "needs_reconnect">,
>(accounts: readonly A[]): A[] {
  return accounts.filter(
    (account) => account.role === null && !account.needs_reconnect,
  );
}

export interface BankGroup<A> {
  /** The bank's name, or null for accounts recorded before banks were. */
  bank: string | null;
  /** When the bank stops sharing: the earliest among its accounts. */
  consentValidUntil: string | null;
  accounts: A[];
}

const ROLE_ORDER: Record<BankAccountRole, number> = {
  spending: 0,
  savings: 1,
  ignored: 2,
};

/**
 * Accounts as the user knows them: by bank, the banks in name order and an
 * unnamed one last, each bank's current accounts first, then its Livrets,
 * then what is not followed.
 */
export function groupByBank<
  A extends Pick<
    BankAccount,
    "bank_name" | "consent_valid_until" | "label" | "role"
  >,
>(accounts: readonly A[]): BankGroup<A>[] {
  const groups = new Map<string | null, A[]>();
  for (const account of accounts) {
    const bank = account.bank_name || null;
    groups.set(bank, [...(groups.get(bank) ?? []), account]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) =>
      a === null ? 1 : b === null ? -1 : a.localeCompare(b, "fr"),
    )
    .map(([bank, members]) => ({
      bank,
      consentValidUntil:
        members
          .map((account) => account.consent_valid_until)
          .filter((until): until is string => Boolean(until))
          .sort()[0] ?? null,
      accounts: [...members].sort(
        (a, b) =>
          ROLE_ORDER[a.role ?? "ignored"] - ROLE_ORDER[b.role ?? "ignored"] ||
          a.label.localeCompare(b.label, "fr"),
      ),
    }));
}
