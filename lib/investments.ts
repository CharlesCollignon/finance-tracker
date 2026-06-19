import type { TransactionWithCategory } from "@/lib/types/database";
import type { WalletId } from "@/lib/types/database";

export type { WalletId as InvestmentWalletId };

export const INVESTMENT_WALLET_LABELS: Record<WalletId, string> = {
  pea: "PEA",
  cto: "CTO",
  crypto: "Crypto",
};

export const INVESTMENT_WALLET_COLORS: Record<WalletId, string> = {
  pea: "var(--chart-3)",
  cto: "var(--chart-4)",
  crypto: "var(--chart-5)",
};

export const INVESTMENT_WALLET_IDS: WalletId[] = [
  "pea",
  "cto",
  "crypto",
];

export const WALLET_LABELS = INVESTMENT_WALLET_LABELS;
export const WALLET_COLORS = INVESTMENT_WALLET_COLORS;
export const WALLET_IDS = INVESTMENT_WALLET_IDS;

export interface WalletTotals {
  pea: number;
  cto: number;
  crypto: number;
  total: number;
}

export interface WalletSummary extends WalletTotals {
  thisMonth: WalletTotals;
}

export interface MonthlyWalletPoint {
  monthKey: string;
  label: string;
  pea: number;
  cto: number;
  crypto: number;
  total: number;
}

const EMPTY_WALLET_TOTALS: WalletTotals = {
  pea: 0,
  cto: 0,
  crypto: 0,
  total: 0,
};

export function resolveWalletId(categoryName: string): WalletId {
  const upper = categoryName.toUpperCase();

  if (upper.includes("PEA")) {
    return "pea";
  }

  if (upper.includes("CTO")) {
    return "cto";
  }

  if (
    upper.includes("BTC") ||
    upper.includes("BITSTACK") ||
    upper.includes("CRYPTO")
  ) {
    return "crypto";
  }

  return "crypto";
}

function addToWallet(
  totals: WalletTotals,
  walletId: WalletId,
  amount: number,
): WalletTotals {
  const next = { ...totals };
  next[walletId] += amount;
  next.total += amount;
  return next;
}

export function sumWalletTotals(
  transactions: TransactionWithCategory[],
): WalletTotals {
  return transactions.reduce(
    (totals, tx) =>
      addToWallet(
        totals,
        resolveWalletId(tx.categories.name),
        Number(tx.amount),
      ),
    { ...EMPTY_WALLET_TOTALS },
  );
}

export function sumWalletTotalsForMonth(
  transactions: TransactionWithCategory[],
  year: number,
  month: number,
): WalletTotals {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  return sumWalletTotals(
    transactions.filter((tx) => tx.occurred_on.startsWith(monthPrefix)),
  );
}

export function buildInvestmentSummary(
  transactions: TransactionWithCategory[],
  year: number,
  month: number,
): WalletSummary {
  const lifetime = sumWalletTotals(transactions);
  const thisMonth = sumWalletTotalsForMonth(transactions, year, month);

  return {
    ...lifetime,
    thisMonth,
  };
}

export function buildCumulativeMonthlySeries(
  transactions: TransactionWithCategory[],
): MonthlyWalletPoint[] {
  const monthly = new Map<string, WalletTotals>();

  for (const tx of transactions) {
    const monthKey = tx.occurred_on.slice(0, 7);
    const current = monthly.get(monthKey) ?? { ...EMPTY_WALLET_TOTALS };
    monthly.set(
      monthKey,
      addToWallet(
        current,
        resolveWalletId(tx.categories.name),
        Number(tx.amount),
      ),
    );
  }

  const sortedKeys = Array.from(monthly.keys()).sort();
  const running: WalletTotals = { ...EMPTY_WALLET_TOTALS };

  return sortedKeys.map((monthKey) => {
    const monthTotals = monthly.get(monthKey)!;
    running.pea += monthTotals.pea;
    running.cto += monthTotals.cto;
    running.crypto += monthTotals.crypto;
    running.total += monthTotals.total;

    const [year, month] = monthKey.split("-").map(Number);

    return {
      monthKey,
      label: new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "2-digit",
      }).format(new Date(year, month - 1, 1)),
      pea: running.pea,
      cto: running.cto,
      crypto: running.crypto,
      total: running.total,
    };
  });
}

export function buildMonthlyContributionSeries(
  transactions: TransactionWithCategory[],
): MonthlyWalletPoint[] {
  const monthly = new Map<string, WalletTotals>();

  for (const tx of transactions) {
    const monthKey = tx.occurred_on.slice(0, 7);
    const current = monthly.get(monthKey) ?? { ...EMPTY_WALLET_TOTALS };
    monthly.set(
      monthKey,
      addToWallet(
        current,
        resolveWalletId(tx.categories.name),
        Number(tx.amount),
      ),
    );
  }

  return Array.from(monthly.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([monthKey, totals]) => {
      const [year, month] = monthKey.split("-").map(Number);

      return {
        monthKey,
        label: new Intl.DateTimeFormat("en-GB", {
          month: "short",
          year: "2-digit",
        }).format(new Date(year, month - 1, 1)),
        ...totals,
      };
    });
}

export interface WalletSetting {
  initialBalance: number;
  currentValue: number | null;
}

export type InvestmentWalletSettings = Record<WalletId, WalletSetting>;

export const EMPTY_WALLET_SETTINGS: InvestmentWalletSettings = {
  pea: { initialBalance: 0, currentValue: null },
  cto: { initialBalance: 0, currentValue: null },
  crypto: { initialBalance: 0, currentValue: null },
};

export function settingsFromRows(
  rows: Array<{
    wallet: WalletId;
    initial_balance: number;
    current_value: number | null;
  }>,
): InvestmentWalletSettings {
  const settings: InvestmentWalletSettings = {
    pea: { initialBalance: 0, currentValue: null },
    cto: { initialBalance: 0, currentValue: null },
    crypto: { initialBalance: 0, currentValue: null },
  };

  for (const row of rows) {
    settings[row.wallet] = {
      initialBalance: Number(row.initial_balance),
      currentValue:
        row.current_value === null ? null : Number(row.current_value),
    };
  }

  return settings;
}

function walletTotalsFromSettings(
  settings: InvestmentWalletSettings,
  pick: (setting: WalletSetting) => number | null,
): WalletTotals {
  const totals = { ...EMPTY_WALLET_TOTALS };

  for (const walletId of WALLET_IDS) {
    const value = pick(settings[walletId]);
    if (value === null) {
      continue;
    }
    totals[walletId] = value;
    totals.total += value;
  }

  return totals;
}

function initialTotals(settings: InvestmentWalletSettings): WalletTotals {
  return walletTotalsFromSettings(settings, (setting) => setting.initialBalance);
}

function marketValueTotals(
  settings: InvestmentWalletSettings,
  totalInvested: WalletTotals,
): WalletTotals {
  const totals = { ...EMPTY_WALLET_TOTALS };

  for (const walletId of WALLET_IDS) {
    const currentValue = settings[walletId].currentValue;
    const value =
      currentValue === null ? totalInvested[walletId] : currentValue;
    totals[walletId] = value;
    totals.total += value;
  }

  return totals;
}

export interface WalletOverview {
  contributions: WalletTotals;
  initial: WalletTotals;
  totalInvested: WalletTotals;
  marketValue: WalletTotals;
  gainLoss: WalletTotals;
  hasMarketValue: Record<WalletId, boolean>;
}

export function buildWalletOverview(
  contributions: WalletTotals,
  settings: InvestmentWalletSettings,
): WalletOverview {
  const initial = initialTotals(settings);
  const totalInvested: WalletTotals = {
    pea: initial.pea + contributions.pea,
    cto: initial.cto + contributions.cto,
    crypto: initial.crypto + contributions.crypto,
    total: initial.total + contributions.total,
  };
  const marketValue = marketValueTotals(settings, totalInvested);
  const hasMarketValue = {
    pea: settings.pea.currentValue !== null,
    cto: settings.cto.currentValue !== null,
    crypto: settings.crypto.currentValue !== null,
  };
  const gainLoss: WalletTotals = {
    pea: hasMarketValue.pea
      ? settings.pea.currentValue! - totalInvested.pea
      : 0,
    cto: hasMarketValue.cto
      ? settings.cto.currentValue! - totalInvested.cto
      : 0,
    crypto: hasMarketValue.crypto
      ? settings.crypto.currentValue! - totalInvested.crypto
      : 0,
    total: 0,
  };
  gainLoss.total = gainLoss.pea + gainLoss.cto + gainLoss.crypto;

  return {
    contributions,
    initial,
    totalInvested,
    marketValue,
    gainLoss,
    hasMarketValue,
  };
}

export function buildTotalInvestedSeries(
  transactions: TransactionWithCategory[],
  settings: InvestmentWalletSettings,
): MonthlyWalletPoint[] {
  const initial = initialTotals(settings);
  const contributionSeries = buildCumulativeMonthlySeries(transactions);

  if (contributionSeries.length === 0) {
    if (initial.total === 0) {
      return [];
    }

    return [
      {
        monthKey: "0000-00",
        label: "Start",
        pea: initial.pea,
        cto: initial.cto,
        crypto: initial.crypto,
        total: initial.total,
      },
    ];
  }

  return contributionSeries.map((point) => ({
    ...point,
    pea: point.pea + initial.pea,
    cto: point.cto + initial.cto,
    crypto: point.crypto + initial.crypto,
    total: point.total + initial.total,
  }));
}

export function hasInvestmentActivity(
  contributions: WalletTotals,
  settings: InvestmentWalletSettings,
): boolean {
  const overview = buildWalletOverview(contributions, settings);
  return overview.totalInvested.total > 0 || overview.marketValue.total > 0;
}
