import type {
  Category,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "@/lib/types/database";
import {
  INVESTMENT_WALLET_IDS,
  resolveWalletId,
  type InvestmentWalletId,
} from "@/lib/investments";

export type { InvestmentWalletId };

export interface InvestmentPositionRow {
  id: string;
  wallet: InvestmentWalletId;
  recurring_template_id: string | null;
  name: string;
  category_id: string | null;
  initial_balance: number;
  current_value: number | null;
  share_count: number | null;
  instrument_symbol: string | null;
  instrument_name: string | null;
}

export interface PositionChartPoint {
  label: string;
  invested: number;
  market: number | null;
}

export interface InvestmentPositionItem {
  id: string;
  walletId: InvestmentWalletId;
  recurringTemplateId: string | null;
  name: string;
  icon: string | null;
  categoryId: string | null;
  initialBalance: number;
  currentValue: number | null;
  shareCount: number | null;
  instrumentSymbol: string | null;
  instrumentName: string | null;
  contributions: number;
  totalInvested: number;
  marketValue: number;
  gainLoss: number;
  hasManualValue: boolean;
  hasMarketQuote: boolean;
  chartPoints: PositionChartPoint[];
}

export interface InvestmentColumnSummary {
  walletId: InvestmentWalletId;
  items: InvestmentPositionItem[];
  totalInvested: number;
  totalMarketValue: number;
  totalGainLoss: number;
  hasMarketSnapshot: boolean;
  chartPoints: PositionChartPoint[];
}

export interface InvestmentPortfolioSummary {
  columns: InvestmentColumnSummary[];
  totalInvested: number;
  totalMarketValue: number;
  totalGainLoss: number;
  hasMarketSnapshot: boolean;
}

function recurringInstrument(
  template: RecurringTemplateWithCategory | undefined,
): {
  symbol: string | null;
  name: string | null;
  shareCount: number | null;
} {
  if (!template || template.pricing_type !== "shares") {
    return { symbol: null, name: null, shareCount: null };
  }

  return {
    symbol: template.instrument_symbol,
    name: template.instrument_name,
    shareCount: template.share_count,
  };
}

function transactionBelongsToPosition(
  tx: TransactionWithCategory,
  position: InvestmentPositionRow,
  trackedRecurringIds: Set<string>,
): boolean {
  if (
    position.recurring_template_id &&
    tx.recurring_template_id === position.recurring_template_id
  ) {
    return true;
  }

  if (
    !position.recurring_template_id &&
    position.category_id &&
    tx.category_id === position.category_id &&
    (tx.recurring_template_id === null ||
      !trackedRecurringIds.has(tx.recurring_template_id))
  ) {
    return true;
  }

  return false;
}

function contributionsForPosition(
  position: InvestmentPositionRow,
  transactions: TransactionWithCategory[],
  trackedRecurringIds: Set<string>,
): number {
  return transactions
    .filter((tx) =>
      transactionBelongsToPosition(tx, position, trackedRecurringIds),
    )
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
}

function buildPositionChartPoints(
  position: InvestmentPositionRow,
  transactions: TransactionWithCategory[],
  trackedRecurringIds: Set<string>,
  marketValue: number,
): PositionChartPoint[] {
  const positionTxs = transactions
    .filter((tx) =>
      transactionBelongsToPosition(tx, position, trackedRecurringIds),
    )
    .sort((left, right) => left.occurred_on.localeCompare(right.occurred_on));

  const monthly = new Map<string, number>();

  for (const tx of positionTxs) {
    const monthKey = tx.occurred_on.slice(0, 7);
    monthly.set(monthKey, (monthly.get(monthKey) ?? 0) + Number(tx.amount));
  }

  const points: PositionChartPoint[] = [];
  let running = position.initial_balance;

  if (position.initial_balance > 0 || monthly.size === 0) {
    points.push({
      label: "Start",
      invested: position.initial_balance,
      market: null,
    });
  }

  for (const [monthKey, amount] of Array.from(monthly.entries()).sort()) {
    running += amount;
    const [year, month] = monthKey.split("-").map(Number);
    points.push({
      label: new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "2-digit",
      }).format(new Date(year, month - 1, 1)),
      invested: running,
      market: null,
    });
  }

  const lastInvested =
    points.length > 0 ? points[points.length - 1].invested : position.initial_balance;

  points.push({
    label: "Now",
    invested: lastInvested,
    market: marketValue,
  });

  if (points.length === 1) {
    points.unshift({
      label: "Start",
      invested: position.initial_balance,
      market: null,
    });
  }

  return points;
}

function buildColumnChartPoints(items: InvestmentPositionItem[]): PositionChartPoint[] {
  if (items.length === 0) {
    return [];
  }

  const labelOrder: string[] = [];
  const investedByLabel = new Map<string, number>();

  for (const item of items) {
    for (const point of item.chartPoints) {
      if (point.label === "Now") {
        continue;
      }

      if (!investedByLabel.has(point.label)) {
        labelOrder.push(point.label);
      }

      investedByLabel.set(
        point.label,
        (investedByLabel.get(point.label) ?? 0) + point.invested,
      );
    }
  }

  const points: PositionChartPoint[] = labelOrder.map((label) => ({
    label,
    invested: investedByLabel.get(label) ?? 0,
    market: null,
  }));

  const totalInvested = items.reduce((sum, item) => sum + item.totalInvested, 0);
  const totalMarket = items.reduce((sum, item) => sum + item.marketValue, 0);

  points.push({
    label: "Now",
    invested: totalInvested,
    market: totalMarket,
  });

  return points;
}

function buildPositionItem(
  row: InvestmentPositionRow,
  transactions: TransactionWithCategory[],
  trackedRecurringIds: Set<string>,
  recurringById: Map<string, RecurringTemplateWithCategory>,
  categoriesById: Map<string, Category>,
  liveQuotes: Record<string, number>,
): InvestmentPositionItem {
  const template = row.recurring_template_id
    ? recurringById.get(row.recurring_template_id)
    : undefined;
  const category = row.category_id
    ? categoriesById.get(row.category_id)
    : template
      ? categoriesById.get(template.category_id)
      : undefined;
  const recurringMeta = recurringInstrument(template);
  const contributions = contributionsForPosition(
    row,
    transactions,
    trackedRecurringIds,
  );
  const totalInvested = row.initial_balance + contributions;
  const instrumentSymbol =
    row.instrument_symbol ?? recurringMeta.symbol ?? null;
  const instrumentName = row.instrument_name ?? recurringMeta.name ?? null;
  const shareCount = row.share_count ?? recurringMeta.shareCount ?? null;
  const hasManualValue =
    row.current_value !== null && row.current_value !== undefined;
  const quotedPrice = instrumentSymbol
    ? liveQuotes[instrumentSymbol]
    : undefined;
  const hasMarketQuote =
    quotedPrice !== undefined && shareCount !== null && shareCount > 0;
  const autoMarketValue = hasMarketQuote
    ? Math.round(shareCount! * quotedPrice! * 100) / 100
    : null;
  const marketValue = hasManualValue
    ? Number(row.current_value)
    : autoMarketValue ?? totalInvested;
  const gainLoss = marketValue - totalInvested;

  return {
    id: row.id,
    walletId: row.wallet,
    recurringTemplateId: row.recurring_template_id,
    name: row.name,
    icon: category?.icon ?? template?.categories.icon ?? null,
    categoryId: row.category_id ?? template?.category_id ?? null,
    initialBalance: row.initial_balance,
    currentValue: hasManualValue ? Number(row.current_value) : null,
    shareCount,
    instrumentSymbol,
    instrumentName,
    contributions,
    totalInvested,
    marketValue,
    gainLoss,
    hasManualValue,
    hasMarketQuote,
    chartPoints: buildPositionChartPoints(
      row,
      transactions,
      trackedRecurringIds,
      marketValue,
    ),
  };
}

export function buildInvestmentPortfolio(
  categories: Category[],
  transactions: TransactionWithCategory[],
  positionRows: InvestmentPositionRow[],
  recurringTemplates: RecurringTemplateWithCategory[],
  liveQuotes: Record<string, number>,
): InvestmentPortfolioSummary {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const recurringById = new Map(
    recurringTemplates.map((template) => [template.id, template]),
  );
  const trackedRecurringIds = new Set(
    positionRows
      .map((row) => row.recurring_template_id)
      .filter((id): id is string => id !== null),
  );

  const items = positionRows.map((row) =>
    buildPositionItem(
      row,
      transactions,
      trackedRecurringIds,
      recurringById,
      categoriesById,
      liveQuotes,
    ),
  );

  const columns: InvestmentColumnSummary[] = INVESTMENT_WALLET_IDS.map(
    (walletId) => {
      const walletItems = items.filter((item) => item.walletId === walletId);
      const totalInvested = walletItems.reduce(
        (sum, item) => sum + item.totalInvested,
        0,
      );
      const totalMarketValue = walletItems.reduce(
        (sum, item) => sum + item.marketValue,
        0,
      );

      return {
        walletId,
        items: walletItems,
        totalInvested,
        totalMarketValue,
        totalGainLoss: totalMarketValue - totalInvested,
        hasMarketSnapshot: walletItems.some(
          (item) => item.hasManualValue || item.hasMarketQuote,
        ),
        chartPoints: buildColumnChartPoints(walletItems),
      };
    },
  );

  const totalInvested = columns.reduce(
    (sum, column) => sum + column.totalInvested,
    0,
  );
  const totalMarketValue = columns.reduce(
    (sum, column) => sum + column.totalMarketValue,
    0,
  );

  return {
    columns,
    totalInvested,
    totalMarketValue,
    totalGainLoss: totalMarketValue - totalInvested,
    hasMarketSnapshot: columns.some((column) => column.hasMarketSnapshot),
  };
}

export function portfolioHasActivity(portfolio: InvestmentPortfolioSummary): boolean {
  return portfolio.columns.some(
    (column) => column.items.length > 0 || column.totalInvested > 0,
  );
}

export function recurringTemplatesForWallet(
  walletId: InvestmentWalletId,
  templates: RecurringTemplateWithCategory[],
  trackedRecurringIds: Set<string>,
): RecurringTemplateWithCategory[] {
  return templates.filter((template) => {
    if (template.categories.type !== "investment") {
      return false;
    }

    if (template.categories.counts_toward_summary !== false) {
      return false;
    }

    if (trackedRecurringIds.has(template.id)) {
      return false;
    }

    return resolveWalletId(template.categories.name) === walletId;
  });
}

export function displayNameForRecurringTemplate(
  template: RecurringTemplateWithCategory,
): string {
  if (template.description?.trim()) {
    return template.description.trim();
  }

  if (template.instrument_name) {
    return template.instrument_name;
  }

  return template.categories.name;
}
