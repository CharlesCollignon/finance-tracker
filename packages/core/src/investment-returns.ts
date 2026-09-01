/**
 * Per-wallet and whole-portfolio money-weighted return.
 *
 * The dated cashflows come from investment transactions; the totals come from
 * the portfolio summary. Those two can disagree — a position can carry an
 * opening balance from before the user started tracking, which has a value but
 * no transaction behind it. Rather than report a rate computed from cashflows
 * that do not add up to the invested total, the gap is added as one opening
 * contribution, so `invested` always matches what the rest of the app shows.
 */

import { resolveWalletId, type InvestmentWalletId } from "./investments";
import type { InvestmentPortfolioSummary } from "./investment-positions";
import type { TransactionWithCategory } from "./types/database";
import { buildPortfolioReturn, type PortfolioReturn } from "./xirr";

export interface WalletReturn extends PortfolioReturn {
  walletId: InvestmentWalletId;
}

export interface InvestmentReturns {
  wallets: WalletReturn[];
  total: PortfolioReturn;
}

interface Contribution {
  date: string;
  amount: number;
}

/**
 * A transaction that actually moved money into a wallet.
 *
 * Categories excluded from the summary are the deployment side of investing
 * (the buy), which is the cashflow that belongs in a return calculation; the
 * counted ones are the budget-side transfer and would double up.
 */
function isDeployment(tx: TransactionWithCategory): boolean {
  return (
    tx.categories.type === "investment" &&
    tx.categories.counts_toward_summary === false
  );
}

function contributionsByWallet(
  transactions: TransactionWithCategory[],
): Map<InvestmentWalletId, Contribution[]> {
  const byWallet = new Map<InvestmentWalletId, Contribution[]>();

  for (const tx of transactions) {
    if (!isDeployment(tx)) {
      continue;
    }
    const walletId = resolveWalletId(tx.categories.name);
    const list = byWallet.get(walletId) ?? [];
    list.push({ date: tx.occurred_on, amount: Number(tx.amount) });
    byWallet.set(walletId, list);
  }

  return byWallet;
}

/** Cents of slack, below which the totals are considered to agree. */
const RECONCILE_EPSILON = 0.01;

/**
 * Adds the untracked opening balance as a single dated contribution so the
 * cashflows sum to what the portfolio says was invested.
 */
function reconcile(
  contributions: Contribution[],
  totalInvested: number,
  asOfDate: string,
): Contribution[] {
  const tracked = contributions.reduce((sum, row) => sum + row.amount, 0);
  const gap = totalInvested - tracked;

  if (gap <= RECONCILE_EPSILON) {
    return contributions;
  }

  // Dated before everything else, because an opening balance predates the
  // transactions the user has recorded.
  const earliest = contributions.reduce<string | null>(
    (min, row) => (min === null || row.date < min ? row.date : min),
    null,
  );

  return [{ date: earliest ?? asOfDate, amount: gap }, ...contributions];
}

/**
 * Returns for each wallet and for the portfolio as a whole.
 *
 * A wallet with no contributions still appears, so the UI can say why there is
 * no figure rather than silently omitting a wallet the user knows they hold.
 */
export function buildInvestmentReturns(
  transactions: TransactionWithCategory[],
  portfolio: InvestmentPortfolioSummary,
  asOfDate: string,
): InvestmentReturns {
  const byWallet = contributionsByWallet(transactions);
  const allContributions: Contribution[] = [];

  const wallets: WalletReturn[] = portfolio.columns.map((column) => {
    const contributions = reconcile(
      byWallet.get(column.walletId) ?? [],
      column.totalInvested,
      asOfDate,
    );
    allContributions.push(...contributions);

    return {
      walletId: column.walletId,
      ...buildPortfolioReturn(
        contributions,
        column.totalMarketValue,
        asOfDate,
      ),
    };
  });

  return {
    wallets,
    total: buildPortfolioReturn(
      allContributions,
      portfolio.totalMarketValue,
      asOfDate,
    ),
  };
}

/** Plain-language reason a rate is missing, for the UI to show in its place. */
export function returnUnavailableLabel(
  reason: PortfolioReturn["unavailableReason"],
): string | null {
  switch (reason) {
    case "no-contributions":
      return "No contributions yet";
    case "too-short":
      return "Too new to annualise";
    case "not-solvable":
      return "Not enough history";
    case null:
      return null;
  }
}
