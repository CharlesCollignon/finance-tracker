import { ALLOCATION_COLORS } from "./category-styles";
import { investedForSavingsRate } from "./constants";
import {
  INVESTMENT_WALLET_IDS,
  INVESTMENT_WALLET_LABELS,
  matchWalletId,
  type InvestmentWalletId,
} from "./investments";
import type { CategoryBreakdown, MonthlySummary } from "./types/database";

export interface SankeyNode {
  name: string;
  label: string;
  itemStyle: { color: string };
  /** Explicit depth keeps columns aligned in ECharts. */
  depth?: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface IncomeSankeyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** Same invested total used by savings rate. */
  invested: number;
}

type MidBucket = {
  key: string;
  label: string;
  value: number;
  color: string;
  leaves: { id: string; name: string; total: number }[];
};

function addWalletTotals(
  totals: Record<InvestmentWalletId, number>,
  breakdowns: CategoryBreakdown[],
  onlyEmptyWallets: boolean,
): void {
  for (const row of breakdowns) {
    if (row.total <= 0) {
      continue;
    }
    const walletId = matchWalletId(row.name);
    if (walletId === null) {
      continue;
    }
    if (onlyEmptyWallets && totals[walletId] > 0) {
      continue;
    }
    totals[walletId] += row.total;
  }
}

function walletLeavesFromSummary(
  summary: MonthlySummary,
): { id: string; name: string; total: number }[] {
  const totals: Record<InvestmentWalletId, number> = {
    pea: 0,
    cto: 0,
    crypto: 0,
  };

  addWalletTotals(totals, summary.investmentDeploymentBreakdown, false);
  addWalletTotals(totals, summary.investmentBreakdown, true);

  return INVESTMENT_WALLET_IDS.filter((id) => totals[id] > 0).map((id) => ({
    id,
    name: INVESTMENT_WALLET_LABELS[id],
    total: Math.round(totals[id] * 100) / 100,
  }));
}

function sortLeavesByValueDesc(
  leaves: { id: string; name: string; total: number }[],
): { id: string; name: string; total: number }[] {
  return [...leaves]
    .filter((leaf) => leaf.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Build Income → mid buckets → category / wallet leaves for a Sankey.
 * Node order is stable (depth 0 → 1 → 2, groups unmixed) so the chart
 * layout stays organized when layoutIterations is 0.
 */
export function buildIncomeSankey(
  summary: MonthlySummary,
): IncomeSankeyGraph | null {
  if (summary.income <= 0) {
    return null;
  }

  const invested = investedForSavingsRate(
    summary.investments,
    summary.investmentDeployments,
  );

  const investmentLeaves = walletLeavesFromSummary(summary);
  const walletSum = investmentLeaves.reduce((sum, leaf) => sum + leaf.total, 0);
  const remainder = Math.round((invested - walletSum) * 100) / 100;
  if (remainder > 0.009) {
    investmentLeaves.push({
      id: "other",
      name: "Other",
      total: remainder,
    });
  }

  const mids: MidBucket[] = [
    {
      key: "expenses",
      label: "Expenses",
      value: summary.expenses,
      color: ALLOCATION_COLORS.expenses,
      leaves: sortLeavesByValueDesc(
        summary.expenseBreakdown.map((b) => ({
          id: b.categoryId,
          name: b.name,
          total: b.total,
        })),
      ),
    },
    {
      key: "savings",
      label: "Savings",
      value: summary.savings,
      color: ALLOCATION_COLORS.savings,
      leaves: sortLeavesByValueDesc(
        summary.savingsBreakdown.map((b) => ({
          id: b.categoryId,
          name: b.name,
          total: b.total,
        })),
      ),
    },
    {
      key: "investments",
      label: "Investments",
      value: invested,
      color: ALLOCATION_COLORS.investments,
      leaves: investmentLeaves.filter((leaf) => leaf.total > 0),
    },
  ];

  if (summary.remaining > 0) {
    mids.push({
      key: "remaining",
      label: "Remaining",
      value: summary.remaining,
      color: ALLOCATION_COLORS.remaining,
      // Terminal leaf so Remaining sits in the right column with others.
      leaves: [
        {
          id: "available",
          name: "Available",
          total: summary.remaining,
        },
      ],
    });
  }

  const activeMids = mids.filter((mid) => mid.value > 0);
  if (activeMids.length === 0) {
    return null;
  }

  const nodes: SankeyNode[] = [
    {
      name: "income",
      label: "Income",
      depth: 0,
      itemStyle: { color: ALLOCATION_COLORS.income },
    },
  ];
  const links: SankeyLink[] = [];

  // Depth 1 — all mid buckets first (keeps groups from interleaving).
  for (const mid of activeMids) {
    nodes.push({
      name: mid.key,
      label: mid.label,
      depth: 1,
      itemStyle: { color: mid.color },
    });
    links.push({
      source: "income",
      target: mid.key,
      value: mid.value,
    });
  }

  // Depth 2 — leaves grouped by mid order (expenses, then savings, …).
  for (const mid of activeMids) {
    for (const leaf of mid.leaves) {
      const leafKey = `${mid.key}:${leaf.id}`;
      nodes.push({
        name: leafKey,
        label: leaf.name,
        depth: 2,
        itemStyle: { color: mid.color },
      });
      links.push({
        source: mid.key,
        target: leafKey,
        value: leaf.total,
      });
    }
  }

  return { nodes, links, invested };
}
