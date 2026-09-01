/**
 * What holding the portfolio costs each year.
 *
 * The ongoing charge is deducted continuously from a fund's value, so it never
 * appears as a transaction and most people have never worked out what theirs
 * comes to. Turning a percentage into a euro figure is the whole point: 0.38%
 * sounds like nothing and €76 a year does not.
 *
 * Nothing here invents a benchmark. Where a comparison is offered it is
 * against the cheapest fund the user already holds — their own data, not a
 * market reference this module has no business asserting.
 */

import type { InvestmentWalletId } from "./investments";

export interface CostedPosition {
  positionId: string;
  name: string;
  walletId: InvestmentWalletId;
  marketValue: number;
  /** Annual charge as a fraction: 0.002 = 0.20%. Null when not recorded. */
  ongoingCharge: number | null;
  /** marketValue × ongoingCharge, or null when the charge is unknown. */
  annualCost: number | null;
}

export interface PositionCostInput {
  positionId: string;
  name: string;
  walletId: InvestmentWalletId;
  marketValue: number;
  ongoingCharge: number | null;
}

export interface FundCostSummary {
  rows: CostedPosition[];
  /** Total yearly cost across positions that have a charge recorded. */
  totalAnnualCost: number;
  /** Market value of positions with a charge recorded. */
  coveredValue: number;
  /** Market value still missing a charge — the figure is partial until zero. */
  uncoveredValue: number;
  /** Value-weighted average charge over the covered value, as a fraction. */
  weightedAverage: number | null;
  /** The cheapest holding that has a charge and some value behind it. */
  cheapest: { name: string; ongoingCharge: number } | null;
  /**
   * What the covered value would cost at the cheapest holding's rate — a
   * comparison drawn entirely from the user's own portfolio.
   */
  costAtCheapest: number | null;
  /** How many positions still need a charge entered. */
  missingCount: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildFundCosts(
  positions: PositionCostInput[],
): FundCostSummary {
  const rows: CostedPosition[] = positions.map((position) => ({
    positionId: position.positionId,
    name: position.name,
    walletId: position.walletId,
    marketValue: position.marketValue,
    ongoingCharge: position.ongoingCharge,
    annualCost:
      position.ongoingCharge === null
        ? null
        : round(position.marketValue * position.ongoingCharge),
  }));

  // A position worth nothing costs nothing, and would drag a weighted average
  // towards a rate no money is actually paying.
  const priced = rows.filter(
    (row) => row.ongoingCharge !== null && row.marketValue > 0,
  );

  const coveredValue = priced.reduce((sum, row) => sum + row.marketValue, 0);
  const uncoveredValue = rows
    .filter((row) => row.ongoingCharge === null)
    .reduce((sum, row) => sum + Math.max(0, row.marketValue), 0);

  const totalAnnualCost = round(
    priced.reduce((sum, row) => sum + (row.annualCost ?? 0), 0),
  );

  const weightedAverage =
    coveredValue > 0
      ? priced.reduce(
          (sum, row) => sum + row.ongoingCharge! * row.marketValue,
          0,
        ) / coveredValue
      : null;

  const cheapestRow = priced.reduce<CostedPosition | null>(
    (best, row) =>
      best === null || row.ongoingCharge! < best.ongoingCharge! ? row : best,
    null,
  );

  return {
    rows,
    totalAnnualCost,
    coveredValue,
    uncoveredValue,
    weightedAverage,
    cheapest: cheapestRow
      ? { name: cheapestRow.name, ongoingCharge: cheapestRow.ongoingCharge! }
      : null,
    costAtCheapest: cheapestRow
      ? round(coveredValue * cheapestRow.ongoingCharge!)
      : null,
    missingCount: rows.filter((row) => row.ongoingCharge === null).length,
  };
}

/**
 * What the current charge adds up to over several years, if the balance stays
 * where it is. Deliberately not compounded against growth: that would mean
 * assuming a return, which is the sort of invented number this module avoids.
 */
export function costOverYears(annualCost: number, years: number): number {
  return round(annualCost * years);
}

/**
 * The saving available by matching the cheapest fund already held.
 * Null when there is nothing to compare, or nothing to gain.
 */
export function savingAtCheapest(summary: FundCostSummary): number | null {
  if (summary.costAtCheapest === null) {
    return null;
  }
  const saving = round(summary.totalAnnualCost - summary.costAtCheapest);
  return saving > 0.5 ? saving : null;
}

/** "0.20%" from the stored fraction. */
export function formatCharge(charge: number | null): string {
  if (charge === null) {
    return "—";
  }
  // Trailing zeros dropped: 0.20% reads better than 0.200%.
  const percent = charge * 100;
  const text = percent.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${text}%`;
}

/** Parses "0,20", "0.20", "0.20%" into the stored fraction. */
export function parseChargeInput(value: string): number | null {
  const trimmed = value.trim().replace("%", "").replace(",", ".");
  if (trimmed === "") {
    return null;
  }
  const percent = Number.parseFloat(trimmed);
  if (!Number.isFinite(percent) || percent < 0) {
    return null;
  }
  return Math.round((percent / 100) * 1e5) / 1e5;
}

/** The stored fraction back into what the user types: 0.002 → "0.20". */
export function chargeToInput(charge: number | null): string {
  if (charge === null) {
    return "";
  }
  return (charge * 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Where to look the figure up.
 *
 * justETF is linked rather than scraped: the app sends the user to the page
 * and they type the number back in, which keeps this on the right side of
 * both their terms and a brittle HTML dependency.
 */
export function chargeLookupUrl(
  instrumentSymbol: string | null,
  instrumentName: string | null,
): string | null {
  const query = instrumentSymbol ?? instrumentName;
  if (!query) {
    return null;
  }
  return `https://www.justetf.com/en/search.html?query=${encodeURIComponent(query)}`;
}
