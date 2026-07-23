import type {
  Category,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "./types/database";
import {
  INVESTMENT_WALLET_IDS,
  resolveWalletId,
  type InvestmentWalletId,
} from "./investments";
import { todayIsoLocal } from "./constants";
import {
  BITCOIN_INSTRUMENT,
  isCryptoWallet,
} from "./crypto-holdings";

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
  totalInvested: number;
  marketValue: number;
  gainLoss: number;
  hasManualValue: boolean;
  hasMarketQuote: boolean;
  needsShareCount: boolean;
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

function resolveSharesHeld(
  row: InvestmentPositionRow,
  template: RecurringTemplateWithCategory | undefined,
  transactions: TransactionWithCategory[],
  asOfDate: string,
): number | null {
  if (row.share_count !== null && row.share_count > 0) {
    return row.share_count;
  }

  if (isCryptoWallet(row.wallet)) {
    return null;
  }

  if (
    !template ||
    template.pricing_type !== "shares" ||
    !template.share_count ||
    !row.recurring_template_id
  ) {
    return null;
  }

  const buyCount = transactions.filter(
    (tx) =>
      tx.recurring_template_id === row.recurring_template_id &&
      tx.occurred_on <= asOfDate,
  ).length;

  if (buyCount <= 0) {
    return null;
  }

  return buyCount * template.share_count;
}

function buildPositionChartPoints(
  position: InvestmentPositionRow,
  marketValue: number,
): PositionChartPoint[] {
  const invested = position.initial_balance;

  return [
    {
      label: "Start",
      invested,
      market: null,
    },
    {
      label: "Now",
      invested,
      market: marketValue,
    },
  ];
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
  recurringById: Map<string, RecurringTemplateWithCategory>,
  categoriesById: Map<string, Category>,
  liveQuotes: Record<string, number>,
  asOfDate: string,
): InvestmentPositionItem {
  const template = row.recurring_template_id
    ? recurringById.get(row.recurring_template_id)
    : undefined;
  const category = row.category_id
    ? categoriesById.get(row.category_id)
    : template
      ? categoriesById.get(template.category_id)
      : undefined;
  const isCrypto = isCryptoWallet(row.wallet);
  const instrumentSymbol = isCrypto
    ? row.instrument_symbol ??
      template?.instrument_symbol ??
      BITCOIN_INSTRUMENT.symbol
    : row.instrument_symbol ?? template?.instrument_symbol ?? null;
  const instrumentName = isCrypto
    ? row.instrument_name ??
      template?.instrument_name ??
      BITCOIN_INSTRUMENT.name
    : row.instrument_name ?? template?.instrument_name ?? null;
  const shareCount = resolveSharesHeld(row, template, transactions, asOfDate);
  const totalInvested = row.initial_balance;
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
  const needsShareCount =
    instrumentSymbol !== null &&
    !hasManualValue &&
    !hasMarketQuote;

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
    totalInvested,
    marketValue,
    gainLoss,
    hasManualValue,
    hasMarketQuote,
    needsShareCount,
    chartPoints: buildPositionChartPoints(row, marketValue),
  };
}

export function buildInvestmentPortfolio(
  categories: Category[],
  transactions: TransactionWithCategory[],
  positionRows: InvestmentPositionRow[],
  recurringTemplates: RecurringTemplateWithCategory[],
  liveQuotes: Record<string, number>,
  asOfDate: string = todayIsoLocal(),
): InvestmentPortfolioSummary {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const recurringById = new Map(
    recurringTemplates.map((template) => [template.id, template]),
  );
  const items = positionRows.map((row) =>
    buildPositionItem(
      row,
      transactions,
      recurringById,
      categoriesById,
      liveQuotes,
      asOfDate,
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
