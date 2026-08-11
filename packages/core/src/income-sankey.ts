import { ALLOCATION_COLORS } from "./category-styles";
import type { MonthlySummary } from "./types/database";

export interface SankeyNode {
  name: string;
  label: string;
  itemStyle: { color: string };
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface IncomeSankeyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/**
 * Build Income → mid buckets → category leaves for a Sankey chart.
 */
export function buildIncomeSankey(
  summary: MonthlySummary,
): IncomeSankeyGraph | null {
  if (summary.income <= 0) {
    return null;
  }

  const nodes: SankeyNode[] = [
    {
      name: "income",
      label: "Income",
      itemStyle: { color: ALLOCATION_COLORS.income },
    },
  ];
  const links: SankeyLink[] = [];

  const mids: {
    key: string;
    label: string;
    value: number;
    color: string;
    leaves: { id: string; name: string; total: number }[];
  }[] = [
    {
      key: "expenses",
      label: "Expenses",
      value: summary.expenses,
      color: ALLOCATION_COLORS.expenses,
      leaves: summary.expenseBreakdown.map((b) => ({
        id: b.categoryId,
        name: b.name,
        total: b.total,
      })),
    },
    {
      key: "savings",
      label: "Savings",
      value: summary.savings,
      color: ALLOCATION_COLORS.savings,
      leaves: summary.savingsBreakdown.map((b) => ({
        id: b.categoryId,
        name: b.name,
        total: b.total,
      })),
    },
    {
      key: "investments",
      label: "Investments",
      value: summary.investments,
      color: ALLOCATION_COLORS.investments,
      leaves: summary.investmentBreakdown.map((b) => ({
        id: b.categoryId,
        name: b.name,
        total: b.total,
      })),
    },
  ];

  if (summary.remaining > 0) {
    mids.push({
      key: "remaining",
      label: "Remaining",
      value: summary.remaining,
      color: ALLOCATION_COLORS.remaining,
      leaves: [],
    });
  }

  for (const mid of mids) {
    if (mid.value <= 0) {
      continue;
    }

    nodes.push({
      name: mid.key,
      label: mid.label,
      itemStyle: { color: mid.color },
    });
    links.push({
      source: "income",
      target: mid.key,
      value: mid.value,
    });

    for (const leaf of mid.leaves) {
      if (leaf.total <= 0) {
        continue;
      }
      const leafKey = `${mid.key}:${leaf.id}`;
      nodes.push({
        name: leafKey,
        label: leaf.name,
        itemStyle: { color: mid.color },
      });
      links.push({
        source: mid.key,
        target: leafKey,
        value: leaf.total,
      });
    }
  }

  if (links.length === 0) {
    return null;
  }

  return { nodes, links };
}
