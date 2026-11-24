/**
 * A property's price history: its purchase price carried quarter by quarter
 * by its area's price index, from the quarter it was bought to the latest
 * the index has.
 *
 * It says what the area's prices have done to that price, not what this
 * home would have sold for each quarter: nobody recorded that. Today's
 * estimated value is kept apart from the line when it comes from somewhere
 * else — a market reading, or the user's own figure — so the chart never
 * passes one off as the other.
 *
 * Amounts are the whole property's, as everywhere on a property.
 */

import { quarterOf } from "./price-index";
import type { EstimatedValue, MarketContext } from "./property";
import type { Property } from "./types/database";

export interface PricePoint {
  /** « 2025-Q3 ». */
  quarter: string;
  value: number;
}

export interface PriceHistory {
  /** Oldest first: the quarter the price is carried from, to the latest. */
  points: PricePoint[];
  /** What was paid: the first point. */
  paid: number;
  /** The purchase price as the area's prices have carried it: the last point. */
  carried: number;
  /** The move between the two, as a ratio: 0.124 for +12.4 %. */
  change: number;
  /** The highest quarter, when the line has come down from it since. */
  peak: PricePoint | null;
  /**
   * The index starts after the purchase, so the line does too: it then
   * shows the move since `points[0].quarter`, not since the purchase.
   */
  startsLate: boolean;
  /**
   * Today's estimated value, when it is not the carried price itself: the
   * market's reading, or the user's own figure. Drawn as its own mark.
   */
  estimate: { value: number; kind: "market" | "own" } | null;
}

/** An estimate said to the thousand, as `estimatedValue` says its own. */
function toThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

/**
 * The history, or null when there is none to draw: no index for the area,
 * or a home bought in the index's latest quarter.
 */
export function priceHistory(
  property: Pick<Property, "purchase_price" | "purchased_on">,
  market: MarketContext | null,
  estimate: EstimatedValue,
): PriceHistory | null {
  const path = market?.purchasePath ?? [];
  if (path.length < 2) {
    return null;
  }
  const paid = Number(property.purchase_price);
  // The first point is the price itself, to the euro: it is a fact. Every
  // later one is an estimate, and said to the thousand like any other.
  const points = path.map((step, index) => ({
    quarter: step.quarter,
    value: index === 0 ? paid : toThousand(paid * step.factor),
  }));
  const carried = points.at(-1)!.value;
  const highest = points.reduce((best, point) =>
    point.value > best.value ? point : best,
  );
  const source = estimate.source.kind;

  return {
    points,
    paid,
    carried,
    change: paid > 0 ? carried / paid - 1 : 0,
    peak: highest.value > carried && highest !== points[0] ? highest : null,
    startsLate: points[0]!.quarter > quarterOf(property.purchased_on),
    estimate:
      source === "market" || source === "own"
        ? { value: estimate.value, kind: source }
        : null,
  };
}
