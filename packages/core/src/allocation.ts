/**
 * Target allocation and drift, across every account the user keeps — the
 * savings accounts and the wallets alike, since a Livret A is as much a part
 * of the split as a PEA.
 *
 * Showing the split across accounts says what is; a target says what should be.
 * The difference is the only thing that tells the user to act — and the action
 * is almost always "send this month's contribution somewhere else", not "sell",
 * which for a PEA holder is also the tax-correct answer.
 */

import { INVESTMENT_WALLET_IDS, type InvestmentWalletId } from "./investments";
import { INTL_LOCALES, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import { SAVINGS_KINDS } from "./savings-accounts";
import type { SavingsAccountKind } from "./types/database";

/** One of the user's accounts: a savings account or a wallet. */
export type AccountId = SavingsAccountKind | InvestmentWalletId;

/** Every account, in the order they are listed: savings, then wallets. */
export const ACCOUNT_IDS: readonly AccountId[] = [
  ...SAVINGS_KINDS,
  ...INVESTMENT_WALLET_IDS,
];

export function isSavingsAccountId(id: AccountId): id is SavingsAccountKind {
  return (SAVINGS_KINDS as readonly string[]).includes(id);
}

export interface AccountTarget {
  accountId: AccountId;
  /** Fraction of the portfolio, 0–1. Null means the user set no target. */
  targetWeight: number | null;
}

/** Inside this band the drift is noise, not something to act on. */
export const DRIFT_TOLERANCE_POINTS = 5;

export type AllocationStatus = "no-target" | "on-target" | "over" | "under";

export interface AllocationRow {
  accountId: AccountId;
  value: number;
  /** Share of the portfolio today, 0–1. */
  currentWeight: number;
  targetWeight: number | null;
  /** Percentage points away from target; positive means overweight. */
  driftPoints: number | null;
  /** Euros that would have to move to sit exactly on target. */
  gap: number | null;
  status: AllocationStatus;
}

export interface AllocationSummary {
  rows: AllocationRow[];
  total: number;
  /** True once any account is outside the tolerance band. */
  needsRebalance: boolean;
  /** Sum of the targets that were set — should reach 1 to be meaningful. */
  targetCoverage: number;
}

function targetFor(
  targets: readonly AccountTarget[],
  accountId: AccountId,
): number | null {
  const found = targets.find((target) => target.accountId === accountId);
  const weight = found?.targetWeight ?? null;
  return weight === null || Number.isNaN(weight) ? null : weight;
}

/**
 * Current weights against targets.
 *
 * Drift is only reported when the targets add up to roughly the whole
 * portfolio: against a half-specified target set every account looks
 * overweight, which would be a misleading thing to put on screen.
 *
 * `accounts` are the ones the user keeps, which are the rows, in
 * `ACCOUNT_IDS` order; a value for any other account is left out.
 */
export function buildAllocation(
  values: readonly { accountId: AccountId; value: number }[],
  targets: readonly AccountTarget[],
  accounts: readonly AccountId[],
): AllocationSummary {
  const kept = ACCOUNT_IDS.filter((id) => accounts.includes(id));
  const byAccount = new Map(values.map((row) => [row.accountId, row.value]));
  const total = kept.reduce(
    (sum, id) => sum + Math.max(0, byAccount.get(id) ?? 0),
    0,
  );

  const targetCoverage = kept.reduce((sum, accountId) => {
    return sum + (targetFor(targets, accountId) ?? 0);
  }, 0);

  const targetsUsable = Math.abs(targetCoverage - 1) < 0.005;

  const rows: AllocationRow[] = kept.map((accountId) => {
    const value = Math.max(0, byAccount.get(accountId) ?? 0);
    const currentWeight = total > 0 ? value / total : 0;
    const targetWeight = targetsUsable ? targetFor(targets, accountId) : null;

    if (targetWeight === null) {
      return {
        accountId,
        value,
        currentWeight,
        targetWeight: null,
        driftPoints: null,
        gap: null,
        status: "no-target" as const,
      };
    }

    const driftPoints = (currentWeight - targetWeight) * 100;
    const gap = targetWeight * total - value;

    const status: AllocationStatus =
      Math.abs(driftPoints) <= DRIFT_TOLERANCE_POINTS
        ? "on-target"
        : driftPoints > 0
          ? "over"
          : "under";

    return {
      accountId,
      value,
      currentWeight,
      targetWeight,
      driftPoints,
      gap,
      status,
    };
  });

  return {
    rows,
    total,
    needsRebalance: rows.some(
      (row) => row.status === "over" || row.status === "under",
    ),
    targetCoverage,
  };
}

export interface ContributionSplit {
  accountId: AccountId;
  amount: number;
}

/**
 * Where to send new money so the portfolio moves towards its targets without
 * selling anything.
 *
 * Underweight accounts are filled first, in proportion to how far behind
 * they are. Anything left over once every account is on target is split by
 * target weight, which keeps the portfolio balanced rather than tipping the
 * last account filled.
 */
export function suggestContributionSplit(
  summary: AllocationSummary,
  amount: number,
): ContributionSplit[] {
  if (amount <= 0) {
    return [];
  }

  const targeted = summary.rows.filter((row) => row.targetWeight !== null);
  if (targeted.length === 0) {
    return [];
  }

  const futureTotal = summary.total + amount;

  // How far each account is below where it should be after the money lands.
  const shortfalls = targeted.map((row) => ({
    accountId: row.accountId,
    need: Math.max(0, row.targetWeight! * futureTotal - row.value),
  }));

  const totalNeed = shortfalls.reduce((sum, row) => sum + row.need, 0);

  const split = new Map<AccountId, number>();

  if (totalNeed > 0) {
    const share = Math.min(1, amount / totalNeed);
    for (const row of shortfalls) {
      if (row.need > 0) {
        split.set(row.accountId, row.need * share);
      }
    }
  }

  const allocated = [...split.values()].reduce((sum, value) => sum + value, 0);
  const remainder = amount - allocated;

  if (remainder > 0.005) {
    for (const row of targeted) {
      const extra = remainder * row.targetWeight!;
      split.set(row.accountId, (split.get(row.accountId) ?? 0) + extra);
    }
  }

  return [...split.entries()]
    .map(([accountId, value]) => ({
      accountId,
      amount: Math.round(value * 100) / 100,
    }))
    .filter((row) => row.amount > 0)
    .sort((left, right) => right.amount - left.amount);
}

/**
 * Today's split as whole percentages that add up to exactly 100, so the
 * target editor starts from where the portfolio is rather than from an even
 * split across accounts nobody holds.
 *
 * Largest remainder: each account gets the floor of its share, and the
 * points that rounding lost go to the accounts that lost the most. An empty
 * portfolio starts every account at 0. One entry per row of the summary.
 */
export function currentSplitPercents(
  summary: AllocationSummary,
): Partial<Record<AccountId, number>> {
  const percents: Partial<Record<AccountId, number>> = Object.fromEntries(
    summary.rows.map((row) => [row.accountId, 0]),
  );
  if (summary.total <= 0) {
    return percents;
  }

  const exact = summary.rows.map((row) => ({
    accountId: row.accountId,
    exact: row.currentWeight * 100,
  }));
  let missing = 100;
  for (const row of exact) {
    percents[row.accountId] = Math.floor(row.exact);
    missing -= Math.floor(row.exact);
  }

  const byRemainder = [...exact].sort(
    (left, right) =>
      right.exact -
      Math.floor(right.exact) -
      (left.exact - Math.floor(left.exact)),
  );
  for (const row of byRemainder) {
    if (missing <= 0) {
      break;
    }
    percents[row.accountId] = (percents[row.accountId] ?? 0) + 1;
    missing -= 1;
  }
  return percents;
}

/** Even split across the accounts kept, offered when the user first sets targets. */
export function defaultTargets(
  accounts: readonly AccountId[],
): AccountTarget[] {
  const kept = ACCOUNT_IDS.filter((id) => accounts.includes(id));
  if (kept.length === 0) {
    return [];
  }
  // Whole percentages that add up to exactly 100 — three accounts get 34, 33
  // and 33, not 33 each, which would fall short of the coverage
  // `buildAllocation` needs before it measures anything.
  const base = Math.floor(100 / kept.length);
  const extra = 100 - base * kept.length;
  return kept.map((accountId, index) => ({
    accountId,
    targetWeight: (base + (index < extra ? 1 : 0)) / 100,
  }));
}

/** Percent for display, e.g. 0.6 → "60%" / "60 %". */
export function formatWeight(weight: number | null, locale: Locale): string {
  if (weight === null) {
    return "—";
  }
  const value = new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: 0,
  }).format(weight * 100);
  return translator(locale)("units.percent", { value });
}
