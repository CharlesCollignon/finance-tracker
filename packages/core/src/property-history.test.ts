import { describe, expect, it } from "vitest";
import type { CarryStep } from "./price-index";
import { estimatedValue, type MarketContext } from "./property";
import { priceHistory } from "./property-history";

const BOUGHT = { purchase_price: 250_000, purchased_on: "2021-05-12" };

const PATH: CarryStep[] = [
  { quarter: "2021-Q2", factor: 1 },
  { quarter: "2021-Q3", factor: 1.02 },
  { quarter: "2022-Q3", factor: 1.1 },
  { quarter: "2024-Q1", factor: 1.03 },
  { quarter: "2026-Q2", factor: 1.064 },
];

function market(overrides: Partial<MarketContext> = {}): MarketContext {
  return {
    reading: null,
    purchaseCarry: {
      series: "010567011",
      from: "2021-Q2",
      to: "2026-Q2",
      factor: 1.064,
    },
    purchasePath: PATH,
    ...overrides,
  };
}

function home(overrides: Record<string, unknown> = {}) {
  return {
    kind: "apartment" as const,
    living_area: 52,
    value_pinned: null,
    value_pinned_on: null,
    ...BOUGHT,
    ...overrides,
  };
}

describe("priceHistory", () => {
  it("carries the purchase price quarter by quarter, the price itself first", () => {
    const context = market();
    const history = priceHistory(
      BOUGHT,
      context,
      estimatedValue(home(), context),
    )!;

    expect(history.points).toEqual([
      { quarter: "2021-Q2", value: 250_000 },
      { quarter: "2021-Q3", value: 255_000 },
      { quarter: "2022-Q3", value: 275_000 },
      { quarter: "2024-Q1", value: 258_000 },
      { quarter: "2026-Q2", value: 266_000 },
    ]);
    expect(history.paid).toBe(250_000);
    expect(history.carried).toBe(266_000);
    expect(history.change).toBeCloseTo(0.064, 10);
  });

  it("ends on the estimated value when that is the carried price", () => {
    const context = market();
    const estimate = estimatedValue(home(), context);
    const history = priceHistory(BOUGHT, context, estimate)!;

    expect(estimate.source.kind).toBe("indexed");
    expect(history.carried).toBe(estimate.value);
    expect(history.estimate).toBeNull();
  });

  it("names the highest quarter when prices have come down since", () => {
    const context = market();
    const history = priceHistory(
      BOUGHT,
      context,
      estimatedValue(home(), context),
    )!;
    expect(history.peak).toEqual({ quarter: "2022-Q3", value: 275_000 });
  });

  it("has no peak to name while the latest quarter is the highest", () => {
    const context = market({ purchasePath: PATH.slice(0, 3) });
    const history = priceHistory(
      BOUGHT,
      context,
      estimatedValue(home(), context),
    )!;
    expect(history.peak).toBeNull();
  });

  it("has no peak either when prices only fell since the purchase", () => {
    const context = market({
      purchasePath: [
        { quarter: "2021-Q2", factor: 1 },
        { quarter: "2023-Q2", factor: 0.95 },
        { quarter: "2026-Q2", factor: 0.9 },
      ],
    });
    const history = priceHistory(
      BOUGHT,
      context,
      estimatedValue(home(), context),
    )!;
    expect(history.peak).toBeNull();
    expect(history.change).toBeCloseTo(-0.1, 10);
  });

  it("keeps a market reading's estimate apart from the line", () => {
    const context = market({
      reading: {
        scope: "radius",
        medianM2: 5_400,
        q1M2: 4_900,
        q3M2: 5_900,
        sales: 41,
        periodFrom: "2023-01-01",
        periodTo: "2025-12-31",
        quarter: "2026-Q2",
      },
    });
    const history = priceHistory(
      BOUGHT,
      context,
      estimatedValue(home(), context),
    )!;
    expect(history.estimate).toEqual({ value: 281_000, kind: "market" });
    expect(history.carried).toBe(266_000);
  });

  it("keeps the user's own figure apart too", () => {
    const context = market();
    const history = priceHistory(
      BOUGHT,
      context,
      estimatedValue(
        home({ value_pinned: 300_000, value_pinned_on: "2026-09-01" }),
        context,
      ),
    )!;
    expect(history.estimate).toEqual({ value: 300_000, kind: "own" });
  });

  it("says when the index starts after the purchase", () => {
    const context = market({
      purchasePath: [
        { quarter: "2010-Q1", factor: 1 },
        { quarter: "2026-Q2", factor: 1.4 },
      ],
    });
    const old = { purchase_price: 180_000, purchased_on: "2004-03-01" };
    const history = priceHistory(
      old,
      context,
      estimatedValue(home(old), context),
    )!;
    expect(history.startsLate).toBe(true);
    expect(
      priceHistory(BOUGHT, market(), estimatedValue(home(), market()))!
        .startsLate,
    ).toBe(false);
  });

  it("is null without a path to draw", () => {
    const estimate = estimatedValue(home(), null);
    expect(priceHistory(BOUGHT, null, estimate)).toBeNull();
    expect(
      priceHistory(BOUGHT, market({ purchasePath: [] }), estimate),
    ).toBeNull();
    expect(
      priceHistory(
        BOUGHT,
        market({ purchasePath: PATH.slice(0, 1) }),
        estimate,
      ),
    ).toBeNull();
  });
});
