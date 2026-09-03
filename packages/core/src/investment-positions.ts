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
import { formatMonthCompact, todayIsoLocal } from "./constants";
import { BITCOIN_INSTRUMENT, isCryptoWallet } from "./crypto-holdings";

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
  /** Annual ongoing charge as a fraction: 0.002 = 0.20%. */
  ongoing_charge: number | null;
}

export interface PositionChartPoint {
  /** YYYY-MM when known; used for range filtering. */
  monthKey: string | null;
  label: string;
  invested: number;
  market: number | null;
}

export type PositionChartRange = "1M" | "3M" | "6M" | "1Y" | "All";

const RANGE_MONTHS: Record<Exclude<PositionChartRange, "All">, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
};

/** Keep the trailing window of monthly chart points for a range preset. */
export function sliceChartPointsByRange(
  points: PositionChartPoint[],
  range: PositionChartRange,
): PositionChartPoint[] {
  if (range === "All" || points.length === 0) {
    return points;
  }

  const months = RANGE_MONTHS[range];
  const keyed = points.filter((point) => point.monthKey !== null);

  if (keyed.length === 0) {
    return points.slice(-months);
  }

  const endKey = keyed[keyed.length - 1]!.monthKey!;
  const [endYear, endMonth] = endKey.split("-").map(Number);
  const startDate = new Date(endYear!, endMonth! - months, 1);
  const startKey = `${startDate.getFullYear()}-${String(
    startDate.getMonth() + 1,
  ).padStart(2, "0")}`;

  return points.filter(
    (point) => point.monthKey === null || point.monthKey >= startKey,
  );
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
  /** Annual ongoing charge as a fraction: 0.002 = 0.20%. */
  ongoingCharge: number | null;
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

function monthKeyFromIso(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function formatMonthLabelShort(monthKey: string): string {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return formatMonthCompact(year, month);
}

function listMonthKeys(startMonth: string, endMonth: string): string[] {
  const [startYear, startMonthNum] = startMonth.split("-").map(Number);
  const [endYear, endMonthNum] = endMonth.split("-").map(Number);
  const keys: string[] = [];
  let year = startYear;
  let month = startMonthNum;

  while (year < endYear || (year === endYear && month <= endMonthNum)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return keys;
}

function monthsAgoKey(asOfDate: string, monthsBack: number): string {
  const [year, month] = asOfDate.slice(0, 7).split("-").map(Number);
  const date = new Date(year, month - 1 - monthsBack, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastCloseOnOrBefore(
  history: Record<string, number> | undefined,
  monthKey: string,
): number | null {
  if (!history) {
    return null;
  }

  if (history[monthKey] !== undefined) {
    return history[monthKey]!;
  }

  const keys = Object.keys(history).sort();
  let selected: number | null = null;
  for (const key of keys) {
    if (key > monthKey) {
      break;
    }
    selected = history[key] ?? null;
  }
  return selected;
}

function buildPositionChartPoints(
  position: InvestmentPositionRow,
  transactions: TransactionWithCategory[],
  template: RecurringTemplateWithCategory | undefined,
  marketValue: number,
  instrumentSymbol: string | null,
  historicalQuotes: Record<string, Record<string, number>>,
  asOfDate: string,
): PositionChartPoint[] {
  const linked = position.recurring_template_id
    ? transactions.filter(
        (tx) => tx.recurring_template_id === position.recurring_template_id,
      )
    : [];

  const endMonth = monthKeyFromIso(asOfDate);
  const earliestTx = linked[0]?.occurred_on;
  const startMonth = earliestTx
    ? monthKeyFromIso(earliestTx)
    : monthsAgoKey(asOfDate, 11);
  const monthKeys = listMonthKeys(startMonth, endMonth);

  if (monthKeys.length === 0) {
    return [
      {
        monthKey: endMonth,
        label: "Now",
        invested: position.initial_balance,
        market: marketValue,
      },
    ];
  }

  const history = instrumentSymbol
    ? historicalQuotes[instrumentSymbol]
    : undefined;
  const shareSize =
    template?.pricing_type === "shares" && template.share_count
      ? template.share_count
      : null;

  let cumulativeInvested = 0;
  let txIndex = 0;
  let buyCount = 0;
  const points: PositionChartPoint[] = [];

  for (const monthKey of monthKeys) {
    while (
      txIndex < linked.length &&
      monthKeyFromIso(linked[txIndex]!.occurred_on) <= monthKey
    ) {
      cumulativeInvested += Number(linked[txIndex]!.amount);
      buyCount += 1;
      txIndex += 1;
    }

    const invested =
      linked.length > 0
        ? Math.round(cumulativeInvested * 100) / 100
        : position.initial_balance;

    const isLast = monthKey === endMonth;
    let market: number | null = null;

    if (isLast) {
      market = marketValue;
    } else if (position.share_count !== null && position.share_count > 0) {
      const close = lastCloseOnOrBefore(history, monthKey);
      if (close !== null) {
        market = Math.round(position.share_count * close * 100) / 100;
      }
    } else if (shareSize !== null && buyCount > 0) {
      const close = lastCloseOnOrBefore(history, monthKey);
      if (close !== null) {
        market = Math.round(buyCount * shareSize * close * 100) / 100;
      }
    }

    points.push({
      monthKey,
      label: formatMonthLabelShort(monthKey),
      invested,
      market,
    });
  }

  // If contributions never reached the stored balance, pin the last
  // invested point to the position's canonical total.
  if (points.length > 0 && linked.length > 0) {
    const last = points[points.length - 1]!;
    if (last.invested < position.initial_balance) {
      last.invested = position.initial_balance;
    }
  }

  return points;
}

function buildColumnChartPoints(
  items: InvestmentPositionItem[],
): PositionChartPoint[] {
  if (items.length === 0) {
    return [];
  }

  const keyOrder: string[] = [];
  const labelByKey = new Map<string, string>();
  const investedByKey = new Map<string, number>();
  const marketByKey = new Map<string, number>();
  const marketCountByKey = new Map<string, number>();

  for (const item of items) {
    for (const point of item.chartPoints) {
      const key = point.monthKey ?? point.label;

      if (!investedByKey.has(key)) {
        keyOrder.push(key);
        labelByKey.set(key, point.label);
      }

      investedByKey.set(key, (investedByKey.get(key) ?? 0) + point.invested);

      if (point.market !== null) {
        marketByKey.set(key, (marketByKey.get(key) ?? 0) + point.market);
        marketCountByKey.set(key, (marketCountByKey.get(key) ?? 0) + 1);
      }
    }
  }

  return keyOrder.map((key) => ({
    monthKey: key.includes("-") && key.length === 7 ? key : null,
    label: labelByKey.get(key) ?? key,
    invested: investedByKey.get(key) ?? 0,
    market:
      (marketCountByKey.get(key) ?? 0) > 0 ? (marketByKey.get(key) ?? 0) : null,
  }));
}

function buildPositionItem(
  row: InvestmentPositionRow,
  transactions: TransactionWithCategory[],
  recurringById: Map<string, RecurringTemplateWithCategory>,
  categoriesById: Map<string, Category>,
  liveQuotes: Record<string, number>,
  historicalQuotes: Record<string, Record<string, number>>,
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
    ? (row.instrument_symbol ??
      template?.instrument_symbol ??
      BITCOIN_INSTRUMENT.symbol)
    : (row.instrument_symbol ?? template?.instrument_symbol ?? null);
  const instrumentName = isCrypto
    ? (row.instrument_name ??
      template?.instrument_name ??
      BITCOIN_INSTRUMENT.name)
    : (row.instrument_name ?? template?.instrument_name ?? null);
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
    : (autoMarketValue ?? totalInvested);
  const gainLoss = marketValue - totalInvested;
  const needsShareCount =
    instrumentSymbol !== null && !hasManualValue && !hasMarketQuote;

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
    ongoingCharge:
      row.ongoing_charge === null || row.ongoing_charge === undefined
        ? null
        : Number(row.ongoing_charge),
    totalInvested,
    marketValue,
    gainLoss,
    hasManualValue,
    hasMarketQuote,
    needsShareCount,
    chartPoints: buildPositionChartPoints(
      row,
      transactions,
      template,
      marketValue,
      instrumentSymbol,
      historicalQuotes,
      asOfDate,
    ),
  };
}

export function buildInvestmentPortfolio(
  categories: Category[],
  transactions: TransactionWithCategory[],
  positionRows: InvestmentPositionRow[],
  recurringTemplates: RecurringTemplateWithCategory[],
  liveQuotes: Record<string, number>,
  asOfDate: string = todayIsoLocal(),
  historicalQuotes: Record<string, Record<string, number>> = {},
): InvestmentPortfolioSummary {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
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
      historicalQuotes,
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

export function portfolioHasActivity(
  portfolio: InvestmentPortfolioSummary,
): boolean {
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
