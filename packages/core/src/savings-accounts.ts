/**
 * Savings accounts: the Livret A, the LDDS, the PEL…, each with its own rate,
 * tax, ceiling and balance.
 *
 * Until migration 046 savings were one sum — everything logged in a savings
 * category, net of withdrawals — which is still what stands in for them when
 * a user has declared none. Once declared, an account's balance is the one
 * the user gave on the day they gave it, plus what they have logged in its
 * own category since; or, when it is linked to an account their bank
 * reports, that balance, which is measured rather than added up.
 */

import type { Key } from "./i18n/t";
import type { SavingsAccount, SavingsAccountKind } from "./types/database";
import { INTL_LOCALES, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";

/** In the order they are offered and listed: the regulated ones first. */
export const SAVINGS_KINDS: readonly SavingsAccountKind[] = [
  "livret_a",
  "ldds",
  "lep",
  "cel",
  "pel",
  "livret",
];

export interface SavingsPreset {
  /** Yearly, as a fraction. */
  rate: number;
  /** On the interest, as a fraction. */
  taxOnInterest: number;
  /** The most that can be paid in, or null when there is none. */
  ceiling: number | null;
  /** Whether money can come out without closing the account. */
  liquid: boolean;
}

/**
 * The 2026 French rules, as of 1 August 2026.
 *
 * Livret A and LDDS 1.7%, LEP 2.5%, all three free of income tax and social
 * contributions. CEL 1.25% and a PEL opened in 2026 2%, their interest taxed
 * at the 30% flat tax: both were left out of the 2026 rise in social
 * contributions, which took everything else — a bank's own livret included —
 * to 31.4%. A PEL keeps the rate of the year it was opened, so its rate is
 * the user's to change; a bank livret's rate is the bank's, and 1% is only a
 * place to start. A withdrawal closes a PEL, so it is not money at hand.
 *
 * Checked October 2026 (economie.gouv.fr, Meilleurtaux, Nalo, France
 * Épargne). Revisit each February and August, when the regulated rates move.
 */
export const FRENCH_SAVINGS_2026: Record<SavingsAccountKind, SavingsPreset> = {
  livret_a: { rate: 0.017, taxOnInterest: 0, ceiling: 22_950, liquid: true },
  ldds: { rate: 0.017, taxOnInterest: 0, ceiling: 12_000, liquid: true },
  lep: { rate: 0.025, taxOnInterest: 0, ceiling: 10_000, liquid: true },
  cel: { rate: 0.0125, taxOnInterest: 0.3, ceiling: 15_300, liquid: true },
  pel: { rate: 0.02, taxOnInterest: 0.3, ceiling: 61_200, liquid: false },
  livret: { rate: 0.01, taxOnInterest: 0.314, ceiling: null, liquid: true },
};

/** "Livret A", "LDDS", "PEL": what the account is called in a list. */
export const SAVINGS_KIND_SHORT_KEYS: Record<SavingsAccountKind, Key> = {
  livret_a: "accounts.shortLivretA",
  ldds: "accounts.shortLdds",
  lep: "accounts.shortLep",
  cel: "accounts.shortCel",
  pel: "accounts.shortPel",
  livret: "accounts.shortLivret",
};

/** The account's full name, spelled out once under the short one. */
export const SAVINGS_KIND_NAME_KEYS: Record<SavingsAccountKind, Key> = {
  livret_a: "accounts.nameLivretA",
  ldds: "accounts.nameLdds",
  lep: "accounts.nameLep",
  cel: "accounts.nameCel",
  pel: "accounts.namePel",
  livret: "accounts.nameLivret",
};

/** How its interest is taxed, in a sentence. */
export const SAVINGS_KIND_TAX_KEYS: Record<SavingsAccountKind, Key> = {
  livret_a: "accounts.taxFree",
  ldds: "accounts.taxFree",
  lep: "accounts.taxFree",
  cel: "accounts.taxCel",
  pel: "accounts.taxPel",
  livret: "accounts.taxLivret",
};

/** Where its rate comes from, in a sentence. */
export const SAVINGS_KIND_RATE_KEYS: Record<SavingsAccountKind, Key> = {
  livret_a: "accounts.rateRegulated",
  ldds: "accounts.rateRegulated",
  lep: "accounts.rateRegulated",
  cel: "accounts.rateRegulated",
  pel: "accounts.ratePel",
  livret: "accounts.rateLivret",
};

/** The account's rate: the user's, for a PEL or a bank livret, or the law's. */
export function savingsRate(
  account: Pick<SavingsAccount, "kind" | "annual_rate">,
): number {
  return account.annual_rate ?? FRENCH_SAVINGS_2026[account.kind].rate;
}

/** A savings movement, dated by the day its money moved. */
export interface SavingsMovement {
  categoryId: string;
  /** The cash date (`cashDateOf`), since a balance is what it is about. */
  movedOn: string;
  amount: number;
}

/** What a bank reports for one of the user's accounts. */
export interface ReportedAccount {
  provider_account_id: string;
  reported_balance: number | null;
  reported_on: string | null;
}

export interface SavingsBalance {
  kind: SavingsAccountKind;
  balance: number;
  /** The day the balance was true, before anything logged since. */
  asOf: string;
  /** What was logged in the account's category after `asOf`. */
  added: number;
  source: "bank" | "given";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * What an account holds today.
 *
 * A linked bank account's reported balance wins: it is measured. Otherwise
 * the balance the user gave, plus what they logged in the account's own
 * category after that day — never on it, since the balance they read that
 * day already held it.
 */
export function savingsBalance(
  account: Pick<
    SavingsAccount,
    "kind" | "balance" | "balance_on" | "category_id" | "bank_account_id"
  >,
  movements: readonly SavingsMovement[],
  reported: readonly ReportedAccount[],
): SavingsBalance {
  const bank = account.bank_account_id
    ? reported.find(
        (row) =>
          row.provider_account_id === account.bank_account_id &&
          row.reported_balance !== null,
      )
    : undefined;
  if (bank && bank.reported_balance !== null) {
    return {
      kind: account.kind,
      balance: roundMoney(Number(bank.reported_balance)),
      asOf: bank.reported_on ?? account.balance_on,
      added: 0,
      source: "bank",
    };
  }

  const added = account.category_id
    ? movements
        .filter(
          (movement) =>
            movement.categoryId === account.category_id &&
            movement.movedOn > account.balance_on,
        )
        .reduce((sum, movement) => sum + movement.amount, 0)
    : 0;

  return {
    kind: account.kind,
    balance: roundMoney(Math.max(0, Number(account.balance) + added)),
    asOf: account.balance_on,
    added: roundMoney(added),
    source: "given",
  };
}

/** A year's interest after its tax, at today's balance. */
export function yearlyInterest(
  balance: number,
  account: Pick<SavingsAccount, "kind" | "annual_rate">,
): number {
  return roundMoney(
    balance *
      savingsRate(account) *
      (1 - FRENCH_SAVINGS_2026[account.kind].taxOnInterest),
  );
}

/**
 * The account that savings logged in no account's own category go to: the
 * Livret A if there is one, else the first account at hand, else the first.
 */
export function defaultSavingsKind(
  kinds: readonly SavingsAccountKind[],
): SavingsAccountKind | null {
  const ordered = SAVINGS_KINDS.filter((kind) => kinds.includes(kind));
  return (
    ordered.find((kind) => FRENCH_SAVINGS_2026[kind].liquid) ??
    ordered[0] ??
    null
  );
}

/** What could be taken out tomorrow: every account but a PEL. */
export function liquidSavings(balances: readonly SavingsBalance[]): number {
  return roundMoney(
    balances
      .filter((balance) => FRENCH_SAVINGS_2026[balance.kind].liquid)
      .reduce((sum, balance) => sum + balance.balance, 0),
  );
}

/** Whether an account id names a savings account rather than a wallet. */
export function isSavingsKind(id: string): id is SavingsAccountKind {
  return SAVINGS_KINDS.includes(id as SavingsAccountKind);
}

/**
 * A yearly rate, to two decimals: 0.0125 → "1,25 %". Regulated rates move by
 * quarter points, so the one decimal the app's other percentages keep would
 * show a CEL at 1,3 %.
 */
export function formatRate(rate: number, locale: Locale): string {
  const value = new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: 2,
  }).format(rate * 100);
  return translator(locale)("units.percent", { value });
}
