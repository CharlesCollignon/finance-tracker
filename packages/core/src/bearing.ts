/**
 * Where the whole of it stands, on one day.
 *
 * Every other engine in this package answers a question about a slice: a
 * month's flows, a wallet's return, the charges a schedule calls for. Nothing
 * added them up, because until there was a surface asking "where do I stand",
 * nothing needed to. This is that arithmetic, and it is deliberately small —
 * four figures, because four is how many the app can defend.
 *
 * The rest of the Bearing's numbers already exist elsewhere and are composed
 * rather than recomputed. `bearing-facts.ts` is where they are gathered into
 * a pack; this module only holds what nothing else computes.
 *
 * Pure, and null-propagating on purpose. A net position missing its cash half
 * is not a smaller net position, it is not one at all, and every figure that
 * rests on an unreadable balance comes back null rather than pretending the
 * missing side was zero.
 */

/** Sub-cent differences are rounding, not findings. Same as a close uses. */
const TOLERANCE = 0.01;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** One holding, weighed against the rest. Only what concentration needs. */
export interface WeighedPosition {
  name: string;
  marketValue: number;
}

/**
 * The largest thing the portfolio is riding on.
 *
 * The one portfolio risk this app can measure from what it actually holds.
 * Everything else worth saying about concentration — sector overlap, factor
 * exposure, whether two ETFs track the same index under different names —
 * needs a view of what is *inside* each fund, which the app does not have and
 * has no business guessing at.
 */
export interface Concentration {
  name: string;
  value: number;
  /** Share of the invested total, 0–1. */
  weight: number;
}

export interface BearingInput {
  /**
   * What the accounts the user spends from hold right now, or null when no
   * bank is connected or the balance could not be read. Null is ordinary.
   */
  onHand: number | null;
  /** Every position across every wallet, for the total and the concentration. */
  positions: readonly WeighedPosition[];
}

export interface Bearing {
  /**
   * Cash plus investments.
   *
   * Not called net worth, and the difference is not pedantry: this app records
   * no debts, so a figure presented as someone's worth would be wrong by
   * exactly their mortgage. `bearing-facts.ts` carries a note saying so on the
   * datum itself, because a caveat that only lives in a comment protects
   * nobody.
   *
   * Null when the balance could not be read. The invested half alone is a
   * portfolio value, which the app already shows and already names correctly.
   */
  netPosition: number | null;
  /** Market value across every wallet. Zero when nothing is invested. */
  invested: number;
  /**
   * How much of the net position is invested rather than sitting in an
   * account, 0–1. Null without a readable balance, and null at or below zero,
   * where the ratio would be meaningless rather than merely large.
   */
  investedShare: number | null;
  /** The largest single holding, or null when nothing is held. */
  concentration: Concentration | null;
}

export function buildBearing({ onHand, positions }: BearingInput): Bearing {
  const invested = roundMoney(
    positions.reduce((sum, position) => sum + position.marketValue, 0),
  );

  const netPosition = onHand === null ? null : roundMoney(onHand + invested);

  const investedShare =
    netPosition === null || netPosition <= TOLERANCE
      ? null
      : Math.round((invested / netPosition) * 10000) / 10000;

  return {
    netPosition,
    invested,
    investedShare,
    concentration: largestPosition(positions, invested),
  };
}

/**
 * The heaviest holding, as a share of what is invested.
 *
 * Weighed against the invested total rather than the net position, because
 * the question this answers is about the portfolio's own shape. Cash is not
 * diversification; holding a year's salary in a current account does not make
 * a single-fund portfolio any less single-fund.
 */
function largestPosition(
  positions: readonly WeighedPosition[],
  invested: number,
): Concentration | null {
  if (invested <= TOLERANCE) {
    return null;
  }

  let heaviest: WeighedPosition | null = null;
  for (const position of positions) {
    if (position.marketValue <= 0) {
      continue;
    }
    if (heaviest === null || position.marketValue > heaviest.marketValue) {
      heaviest = position;
    }
  }

  if (heaviest === null) {
    return null;
  }

  return {
    name: heaviest.name,
    value: roundMoney(heaviest.marketValue),
    weight: Math.round((heaviest.marketValue / invested) * 10000) / 10000,
  };
}
