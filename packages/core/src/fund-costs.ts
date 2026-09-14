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
  /** The envelope's own fee, as a fraction. Null when the wrapper takes none. */
  wrapperFee: number | null;
  /** marketValue × wrapperFee. Known even when the fund's own charge is not. */
  wrapperCost: number | null;
  /** ongoingCharge + wrapperFee, or null when the fund's charge is unknown. */
  effectiveCharge: number | null;
  /** What this position really costs a year, both layers together. */
  allInCost: number | null;
}

export interface PositionCostInput {
  positionId: string;
  name: string;
  walletId: InvestmentWalletId;
  marketValue: number;
  ongoingCharge: number | null;
}

/**
 * What each envelope charges on top of the funds inside it.
 *
 * An assurance-vie levies an annual fee on the whole contract, so a unit held
 * there costs its own ongoing charge *plus* this. A PEA, a CTO and crypto take
 * nothing, so their entries are absent or null — the common case is an empty
 * object and no behaviour change at all.
 */
export type WrapperFees = Partial<Record<InvestmentWalletId, number | null>>;

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
  /**
   * What the envelopes take, across every position they hold.
   *
   * Kept apart from the fund figures rather than folded into them, and on a
   * wider base: an envelope's fee is known from the wallet, so it applies to
   * held value whose own ongoing charge was never entered. Reporting one
   * blended number would hide the comparison that matters most — the same
   * fund at 0.20% inside a 0.60% assurance-vie costs four times what it
   * costs in a PEA, and that is a fact about the envelope, not the fund.
   */
  envelopeAnnualCost: number;
  /** Held value sitting in an envelope that charges a fee. */
  envelopeCoveredValue: number;
  /** Value-weighted envelope fee over `envelopeCoveredValue`. */
  weightedEnvelopeFee: number | null;
  /** Fund charges plus envelope fees — what holding all of it really costs. */
  allInAnnualCost: number;
  /**
   * Value-weighted all-in charge, over the value where *both* layers are
   * known. Null until at least one position has an ongoing charge recorded.
   */
  weightedAllIn: number | null;
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
  envelopeFees: WrapperFees = {},
): FundCostSummary {
  const rows: CostedPosition[] = positions.map((position) => {
    const wrapperFee = envelopeFees[position.walletId] ?? null;
    const annualCost =
      position.ongoingCharge === null
        ? null
        : round(position.marketValue * position.ongoingCharge);
    const wrapperCost =
      wrapperFee === null ? null : round(position.marketValue * wrapperFee);
    const effectiveCharge =
      position.ongoingCharge === null
        ? null
        : position.ongoingCharge + (wrapperFee ?? 0);

    return {
      positionId: position.positionId,
      name: position.name,
      walletId: position.walletId,
      marketValue: position.marketValue,
      ongoingCharge: position.ongoingCharge,
      annualCost,
      wrapperFee,
      wrapperCost,
      effectiveCharge,
      allInCost:
        annualCost === null ? null : round(annualCost + (wrapperCost ?? 0)),
    };
  });

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

  // The envelope's own base: every position it holds that is worth something,
  // whether or not the fund's charge was ever entered.
  const enveloped = rows.filter(
    (row) => row.wrapperFee !== null && row.wrapperFee > 0 && row.marketValue > 0,
  );
  const envelopeCoveredValue = enveloped.reduce(
    (sum, row) => sum + row.marketValue,
    0,
  );
  const envelopeAnnualCost = round(
    enveloped.reduce((sum, row) => sum + (row.wrapperCost ?? 0), 0),
  );
  const weightedEnvelopeFee =
    envelopeCoveredValue > 0
      ? enveloped.reduce(
          (sum, row) => sum + row.wrapperFee! * row.marketValue,
          0,
        ) / envelopeCoveredValue
      : null;

  const weightedAllIn =
    coveredValue > 0
      ? priced.reduce(
          (sum, row) => sum + row.effectiveCharge! * row.marketValue,
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
    envelopeAnnualCost,
    envelopeCoveredValue,
    weightedEnvelopeFee,
    allInAnnualCost: round(totalAnnualCost + envelopeAnnualCost),
    weightedAllIn,
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
