/**
 * Target allocation and drift.
 *
 * Showing the split across wallets says what is; a target says what should be.
 * The difference is the only thing that tells the user to act — and the action
 * is almost always "send this month's contribution somewhere else", not "sell",
 * which for a PEA holder is also the tax-correct answer.
 */

import { INVESTMENT_WALLET_IDS, type InvestmentWalletId } from "./investments";

export interface WalletTarget {
  walletId: InvestmentWalletId;
  /** Fraction of the portfolio, 0–1. Null means the user set no target. */
  targetWeight: number | null;
}

/** Inside this band the drift is noise, not something to act on. */
export const DRIFT_TOLERANCE_POINTS = 5;

export type AllocationStatus = "no-target" | "on-target" | "over" | "under";

export interface AllocationRow {
  walletId: InvestmentWalletId;
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
  /** True once any wallet is outside the tolerance band. */
  needsRebalance: boolean;
  /** Sum of the targets that were set — should reach 1 to be meaningful. */
  targetCoverage: number;
}

function targetFor(
  targets: WalletTarget[],
  walletId: InvestmentWalletId,
): number | null {
  const found = targets.find((target) => target.walletId === walletId);
  const weight = found?.targetWeight ?? null;
  return weight === null || Number.isNaN(weight) ? null : weight;
}

/**
 * Current weights against targets.
 *
 * Drift is only reported when the targets add up to roughly the whole
 * portfolio: against a half-specified target set every wallet looks
 * overweight, which would be a misleading thing to put on screen.
 */
export function buildAllocation(
  values: { walletId: InvestmentWalletId; value: number }[],
  targets: WalletTarget[],
): AllocationSummary {
  const byWallet = new Map(values.map((row) => [row.walletId, row.value]));
  const total = values.reduce((sum, row) => sum + Math.max(0, row.value), 0);

  const targetCoverage = INVESTMENT_WALLET_IDS.reduce((sum, walletId) => {
    return sum + (targetFor(targets, walletId) ?? 0);
  }, 0);

  const targetsUsable = Math.abs(targetCoverage - 1) < 0.005;

  const rows: AllocationRow[] = INVESTMENT_WALLET_IDS.map((walletId) => {
    const value = Math.max(0, byWallet.get(walletId) ?? 0);
    const currentWeight = total > 0 ? value / total : 0;
    const targetWeight = targetsUsable ? targetFor(targets, walletId) : null;

    if (targetWeight === null) {
      return {
        walletId,
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
      walletId,
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
  walletId: InvestmentWalletId;
  amount: number;
}

/**
 * Where to send new money so the portfolio moves towards its targets without
 * selling anything.
 *
 * Underweight wallets are filled first, in proportion to how far behind they
 * are. Anything left over once every wallet is on target is split by target
 * weight, which keeps the portfolio balanced rather than tipping the last
 * wallet filled.
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

  // How far each wallet is below where it should be after the money lands.
  const shortfalls = targeted.map((row) => ({
    walletId: row.walletId,
    need: Math.max(0, row.targetWeight! * futureTotal - row.value),
  }));

  const totalNeed = shortfalls.reduce((sum, row) => sum + row.need, 0);

  const split = new Map<InvestmentWalletId, number>();

  if (totalNeed > 0) {
    const share = Math.min(1, amount / totalNeed);
    for (const row of shortfalls) {
      if (row.need > 0) {
        split.set(row.walletId, row.need * share);
      }
    }
  }

  const allocated = [...split.values()].reduce((sum, value) => sum + value, 0);
  const remainder = amount - allocated;

  if (remainder > 0.005) {
    for (const row of targeted) {
      const extra = remainder * row.targetWeight!;
      split.set(row.walletId, (split.get(row.walletId) ?? 0) + extra);
    }
  }

  return [...split.entries()]
    .map(([walletId, value]) => ({
      walletId,
      amount: Math.round(value * 100) / 100,
    }))
    .filter((row) => row.amount > 0)
    .sort((left, right) => right.amount - left.amount);
}

/** Even split across the wallets, offered when the user first sets targets. */
export function defaultTargets(): WalletTarget[] {
  const share = 1 / INVESTMENT_WALLET_IDS.length;
  return INVESTMENT_WALLET_IDS.map((walletId) => ({
    walletId,
    targetWeight: Math.round(share * 100) / 100,
  }));
}

/** Percent for display, e.g. 0.6 → "60%". */
export function formatWeight(weight: number | null): string {
  if (weight === null) {
    return "—";
  }
  return `${Math.round(weight * 100)}%`;
}
