import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { translator } from "./i18n/t";
import { formatMonthCompact } from "./constants";
import type { TransactionWithCategory } from "./types/database";
import type { WalletId } from "./types/database";

export type { WalletId as InvestmentWalletId };

/**
 * Untranslated on purpose. "PEA", "CTO", "AV" and "PER" are the French names
 * of French tax wrappers and have no English equivalent to translate to, and
 * "Crypto" is the same word in both languages.
 *
 * "AV" rather than "Assurance-vie" because these labels sit in a tab strip
 * and a wallet picker where the longest one sets the column width, and the
 * abbreviation is what a French saver's own statements use.
 */
export const INVESTMENT_WALLET_LABELS: Record<WalletId, string> = {
  pea: "PEA",
  cto: "CTO",
  av: "AV",
  per: "PER",
  crypto: "Crypto",
};

export const INVESTMENT_WALLET_COLORS: Record<WalletId, string> = {
  pea: "var(--chart-3)",
  cto: "var(--chart-4)",
  av: "var(--chart-1)",
  per: "var(--chart-2)",
  crypto: "var(--chart-5)",
};

/**
 * Every wallet, in the order they are shown.
 *
 * This array is the closed set, and the totals below are keyed off it rather
 * than spelling the wallets out a second time. Two wrappers were added in
 * `030` and the hand-written `{ pea, cto, crypto }` object literals that used
 * to stand here were the whole cost of that change — a sixth wallet should
 * cost one line, not a sweep through the file.
 */
export const INVESTMENT_WALLET_IDS: WalletId[] = [
  "pea",
  "cto",
  "av",
  "per",
  "crypto",
];

/** A figure per wallet, plus their sum. */
export type WalletTotals = Record<WalletId, number> & { total: number };

export interface WalletSummary extends WalletTotals {
  thisMonth: WalletTotals;
}

export type MonthlyWalletPoint = WalletTotals & {
  monthKey: string;
  label: string;
};

function emptyWalletTotals(): WalletTotals {
  const totals = { total: 0 } as WalletTotals;
  for (const walletId of INVESTMENT_WALLET_IDS) {
    totals[walletId] = 0;
  }
  return totals;
}

/**
 * Match a category name to a wallet, or null when nothing matches
 * (e.g. "Broker transfer", which is a cash move, not a wallet buy).
 *
 * `av` and `per` are deliberately absent, and must stay absent. This matches
 * on substrings, and those two abbreviations are too short to be safe in
 * French: "AV" is inside AVENUE, AVANCE and ÉPARGNE AVENIR, and "PER" is
 * inside SUPERMARCHÉ, PERMANENT and PERSONNEL. A rule for either would
 * silently re-file ordinary spending as an investment, which is the worst
 * kind of wrong answer — it looks like data, not like a bug.
 *
 * So a position in one of those two wrappers is assigned explicitly, never
 * guessed from a category name. Returning null here is the honest answer and
 * every caller already has a fallback for it.
 */
export function matchWalletId(categoryName: string): WalletId | null {
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

  return null;
}

export function resolveWalletId(
  categoryName: string,
  fallback: WalletId = "crypto",
): WalletId {
  return matchWalletId(categoryName) ?? fallback;
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
    (totals, tx) => {
      const walletId = matchWalletId(tx.categories.name);
      if (walletId === null) {
        return totals;
      }
      return addToWallet(totals, walletId, Number(tx.amount));
    },
    emptyWalletTotals(),
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
    const walletId = matchWalletId(tx.categories.name);
    if (walletId === null) {
      continue;
    }

    const monthKey = tx.occurred_on.slice(0, 7);
    const current = monthly.get(monthKey) ?? emptyWalletTotals();
    monthly.set(monthKey, addToWallet(current, walletId, Number(tx.amount)));
  }

  const sortedKeys = Array.from(monthly.keys()).sort();
  const running: WalletTotals = emptyWalletTotals();

  return sortedKeys.map((monthKey) => {
    const monthTotals = monthly.get(monthKey)!;
    for (const walletId of INVESTMENT_WALLET_IDS) {
      running[walletId] += monthTotals[walletId];
    }
    running.total += monthTotals.total;

    const [year, month] = monthKey.split("-").map(Number);

    return {
      ...running,
      monthKey,
      label: formatMonthCompact(year, month),
    };
  });
}

export function buildMonthlyContributionSeries(
  transactions: TransactionWithCategory[],
): MonthlyWalletPoint[] {
  const monthly = new Map<string, WalletTotals>();

  for (const tx of transactions) {
    const walletId = matchWalletId(tx.categories.name);
    if (walletId === null) {
      continue;
    }

    const monthKey = tx.occurred_on.slice(0, 7);
    const current = monthly.get(monthKey) ?? emptyWalletTotals();
    monthly.set(monthKey, addToWallet(current, walletId, Number(tx.amount)));
  }

  return Array.from(monthly.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([monthKey, totals]) => {
      const [year, month] = monthKey.split("-").map(Number);

      return {
        monthKey,
        label: formatMonthCompact(year, month),
        ...totals,
      };
    });
}

export interface WalletSetting {
  initialBalance: number;
  currentValue: number | null;
}

export type InvestmentWalletSettings = Record<WalletId, WalletSetting>;

function emptyWalletSettings(): InvestmentWalletSettings {
  const settings = {} as InvestmentWalletSettings;
  for (const walletId of INVESTMENT_WALLET_IDS) {
    settings[walletId] = { initialBalance: 0, currentValue: null };
  }
  return settings;
}

/**
 * Frozen, because it is exported and a caller that mutated it would poison
 * every later reader. `settingsFromRows` builds a fresh one instead.
 */
export const EMPTY_WALLET_SETTINGS: InvestmentWalletSettings = Object.freeze(
  emptyWalletSettings(),
);

export function settingsFromRows(
  rows: Array<{
    wallet: WalletId;
    initial_balance: number;
    current_value: number | null;
  }>,
): InvestmentWalletSettings {
  const settings = emptyWalletSettings();

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
  const totals = emptyWalletTotals();

  for (const walletId of INVESTMENT_WALLET_IDS) {
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
  return walletTotalsFromSettings(
    settings,
    (setting) => setting.initialBalance,
  );
}

function marketValueTotals(
  settings: InvestmentWalletSettings,
  totalInvested: WalletTotals,
): WalletTotals {
  const totals = emptyWalletTotals();

  for (const walletId of INVESTMENT_WALLET_IDS) {
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

  const totalInvested = emptyWalletTotals();
  const hasMarketValue = {} as Record<WalletId, boolean>;
  const gainLoss = emptyWalletTotals();

  for (const walletId of INVESTMENT_WALLET_IDS) {
    totalInvested[walletId] = initial[walletId] + contributions[walletId];

    const currentValue = settings[walletId].currentValue;
    hasMarketValue[walletId] = currentValue !== null;
    gainLoss[walletId] =
      currentValue === null ? 0 : currentValue - totalInvested[walletId];
    gainLoss.total += gainLoss[walletId];
  }
  totalInvested.total = initial.total + contributions.total;

  const marketValue = marketValueTotals(settings, totalInvested);

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
  locale: Locale = DEFAULT_LOCALE,
): MonthlyWalletPoint[] {
  const initial = initialTotals(settings);
  const contributionSeries = buildCumulativeMonthlySeries(transactions);

  if (contributionSeries.length === 0) {
    if (initial.total === 0) {
      return [];
    }

    return [
      {
        ...initial,
        monthKey: "0000-00",
        label: translator(locale)("fallback.chartStart"),
      },
    ];
  }

  return contributionSeries.map((point) => {
    const shifted: MonthlyWalletPoint = { ...point };
    for (const walletId of INVESTMENT_WALLET_IDS) {
      shifted[walletId] = point[walletId] + initial[walletId];
    }
    shifted.total = point.total + initial.total;
    return shifted;
  });
}

export function hasInvestmentActivity(
  contributions: WalletTotals,
  settings: InvestmentWalletSettings,
): boolean {
  const overview = buildWalletOverview(contributions, settings);
  return overview.totalInvested.total > 0 || overview.marketValue.total > 0;
}
