/**
 * What a portfolio is mostly made of.
 *
 * A wallet split answers "how much, and roughly where" — `MonthWallets` draws
 * that already. This answers the different question a concentration figure
 * raises: *which holding* is the one that matters, and by how much. A reader
 * told their largest position is 31% of everything they own has no way to act
 * on it until they are told which position that is.
 *
 * Deliberately not a percentage of the *whole* portfolio including the
 * unpriced part. A holding with no market snapshot is not worth nothing, but
 * it is also not a figure this can weigh against one that has been priced, so
 * a caller hands over the values it trusts and the shares come out of their
 * sum. Everything here is relative to what was actually passed in, which is
 * the only total that cannot be quietly wrong.
 *
 * Pure. Holds no labels — a caller supplies the names it already has.
 */

/** One holding, as much of it as a weighting needs. */
export interface WeighedHolding {
  id: string;
  label: string;
  /** What it is worth. Zero and negative values are dropped, not drawn. */
  value: number;
}

export interface HoldingWeight {
  id: string;
  label: string;
  value: number;
  /** Share of the weighed total, 0–1. */
  weight: number;
}

/**
 * The holdings by share of their own total, largest first.
 *
 * Empty when nothing has a positive value — including the case where the
 * values cancel out — because a bar chart of an empty total is a row of
 * divisions by zero rather than a picture of anything.
 */
export function holdingWeights(
  holdings: readonly WeighedHolding[],
): HoldingWeight[] {
  const counted = holdings.filter((holding) => holding.value > 0);
  const total = counted.reduce((sum, holding) => sum + holding.value, 0);

  if (total <= 0) {
    return [];
  }

  return counted
    .map((holding) => ({
      id: holding.id,
      label: holding.label,
      value: holding.value,
      weight: holding.value / total,
    }))
    .sort((a, b) => b.value - a.value);
}
