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

/**
 * Whether Pluclair follows an account at all — its movements or its
 * balance — as opposed to one not filed yet or left aside: what a bank's
 * consent reminder and its lapsed count are about.
 */
export function isFollowed(role: BankAccountRole | null | undefined): boolean {
  return role === "spending" || role === "savings" || role === "joint";
}

/** Whether an account's movements come into a ledger, a person's or a space's. */
export function importsMovements(
  role: BankAccountRole | null | undefined,
): boolean {
  return role === "spending" || role === "joint";
}

/**
 * The accounts whose balance is an owner's money: a person's current
 * accounts, or the joint accounts feeding a space — once each.
 */
export function countedAccounts<
  A extends Pick<
    BankAccount,
    | "role"
    | "space_id"
    | "iban_hash"
    | "first_seen_at"
    | "user_id"
    | "provider_account_id"
  >,
>(accounts: readonly A[], ownerId: string): A[] {
  const joint = new Set(
    jointFeeders(accounts).filter((account) => account.space_id === ownerId),
  );
  return accounts.filter(
    (account) =>
      joint.has(account) ||
      (account.role === "spending" && account.user_id === ownerId),
  );
}

/**
 * Whose rows an account's movements become: the person's for a current
 * account, their shared space's for a joint one (migration 061), nobody's
 * for the rest — a Livret, a card, one not followed or not filed yet.
 */
export function movementsOwner(
  account: Pick<BankAccount, "role" | "space_id">,
  personId: string,
): string | null {
  if (account.role === "spending") {
    return personId;
  }
  return account.role === "joint" ? account.space_id : null;
}

/**
 * The joint accounts that feed their space: one per account, however many
 * partners connected it. Two connections show the same joint account as two
 * rows with one IBAN fingerprint; the first seen feeds, the other is left
 * out — on both phones and in the sync alike, so it is the same one.
 */
export function jointFeeders<
  A extends Pick<
    BankAccount,
    | "role"
    | "space_id"
    | "iban_hash"
    | "first_seen_at"
    | "user_id"
    | "provider_account_id"
  >,
>(accounts: readonly A[]): A[] {
  const first = new Map<string, A>();
  const order = (account: A) =>
    `${account.first_seen_at}|${account.user_id}|${account.provider_account_id}`;
  for (const account of accounts) {
    if (account.role !== "joint" || !account.space_id) {
      continue;
    }
    // Without a fingerprint an account is only ever itself.
    const key = `${account.space_id}|${account.iban_hash ?? order(account)}`;
    const held = first.get(key);
    if (!held || order(account) < order(held)) {
      first.set(key, account);
    }
  }
  return accounts.filter((account) => [...first.values()].includes(account));
}

/** An IBAN as two banks would both write it. */
export function cleanIban(iban: string | null | undefined): string | null {
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
  joint: 1,
  savings: 2,
  ignored: 3,
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

/**
 * What each account is called on a ledger row: its bank — « BoursoBank » —
 * or its own name where the user follows two current accounts at that bank.
 *
 * Null while there are fewer than two current accounts: one ledger fed by
 * one account has nothing to tell apart, and a bank's name on every row
 * would be noise. Every account gets a name once it is shown, current or
 * not, since rows an account brought in before it was let go stay in the
 * ledger.
 */
export function accountMarks(
  accounts: readonly Pick<
    BankAccount,
    "provider_account_id" | "role" | "bank_name" | "label"
  >[],
): Map<string, string> | null {
  const spending = accounts.filter((account) => account.role === "spending");
  if (spending.length < 2) {
    return null;
  }
  const marks = new Map<string, string>();
  for (const account of accounts) {
    const shared = spending.some(
      (other) =>
        other.provider_account_id !== account.provider_account_id &&
        other.bank_name === account.bank_name,
    );
    marks.set(
      account.provider_account_id,
      account.bank_name && !shared ? account.bank_name : account.label,
    );
  }
  return marks;
}

/** What a ledger needs to tell its accounts apart. */
export interface LedgerAccounts {
  /** Each account's name on a row, by account id. */
  names: Record<string, string>;
  /** The account each row came from, by transaction id. */
  of: Record<string, string>;
  /**
   * The accounts to read one at a time: the current ones, and any other
   * whose rows are on screen. In the Bank page's order.
   */
  options: { id: string; label: string }[];
}

/**
 * Everything a ledger needs to say which account each row came from, or
 * null while there is one current account — see `accountMarks`. Plain
 * records rather than maps, so a server page can hand it to the browser.
 */
export function ledgerAccounts(
  accounts: readonly Pick<
    BankAccount,
    | "provider_account_id"
    | "role"
    | "bank_name"
    | "label"
    | "consent_valid_until"
  >[],
  accountOf: ReadonlyMap<string, string>,
): LedgerAccounts | null {
  const marks = accountMarks(accounts);
  if (!marks) {
    return null;
  }
  const used = new Set(accountOf.values());
  return {
    names: Object.fromEntries(marks),
    of: Object.fromEntries(accountOf),
    options: groupByBank(accounts)
      .flatMap((group) => group.accounts)
      .filter(
        (account) =>
          account.role === "spending" || used.has(account.provider_account_id),
      )
      .map((account) => ({
        id: account.provider_account_id,
        label: marks.get(account.provider_account_id)!,
      })),
  };
}
