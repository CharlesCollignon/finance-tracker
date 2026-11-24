import { describe, expect, it } from "vitest";
import {
  buildHoldingsOverview,
  heldSymbols,
  returnShare,
} from "./holdings-overview";
import {
  emptyPriceSeries,
  type InstrumentPriceSeries,
} from "./instrument-price-series";
import type {
  InvestmentColumnSummary,
  InvestmentPositionItem,
} from "./investment-positions";

function item(
  overrides: Partial<InvestmentPositionItem> = {},
): InvestmentPositionItem {
  return {
    id: "p1",
    walletId: "pea",
    recurringTemplateId: null,
    name: "Amundi MSCI World",
    icon: null,
    categoryId: null,
    initialBalance: 3_000,
    currentValue: null,
    shareCount: 10,
    instrumentSymbol: "CW8.PA",
    instrumentName: null,
    ongoingCharge: null,
    isin: null,
    valuePinned: false,
    valuationSource: "live",
    totalInvested: 3_000,
    marketValue: 3_600,
    gainLoss: 600,
    hasManualValue: false,
    hasMarketQuote: true,
    needsShareCount: false,
    chartPoints: [],
    ...overrides,
  };
}

function column(
  walletId: InvestmentColumnSummary["walletId"],
  items: InvestmentPositionItem[],
): InvestmentColumnSummary {
  return {
    walletId,
    items,
    totalInvested: 0,
    totalMarketValue: 0,
    totalGainLoss: 0,
    hasMarketSnapshot: true,
    chartPoints: [],
  };
}

function series(yearPct: number | null): InstrumentPriceSeries {
  return {
    ...emptyPriceSeries(),
    "1Y": { values: [100, 110], changePct: yearPct },
  };
}

describe("buildHoldingsOverview", () => {
  const portfolio = {
    columns: [
      column("pea", [
        item(),
        item({
          id: "p2",
          name: "Amundi S&P 500",
          instrumentSymbol: "500.PA",
          totalInvested: 1_000,
          marketValue: 900,
          gainLoss: -100,
        }),
      ]),
      column("crypto", [
        item({
          id: "p3",
          walletId: "crypto",
          name: "Bitcoin",
          instrumentSymbol: null,
          totalInvested: 1_200,
          marketValue: 1_500,
          gainLoss: 300,
        }),
      ]),
    ],
  };
  const prices = { "CW8.PA": series(12.4), "500.PA": series(-3.1) };

  it("lists every wallet's holdings together, largest first, with their share", () => {
    const overview = buildHoldingsOverview(portfolio, prices, "1Y");

    expect(overview.total).toBe(6_000);
    expect(overview.rows.map((row) => row.name)).toEqual([
      "Amundi MSCI World",
      "Bitcoin",
      "Amundi S&P 500",
    ]);
    expect(overview.rows.map((row) => row.weight)).toEqual([0.6, 0.25, 0.15]);
  });

  it("keeps the holder's return and the instrument's price apart", () => {
    const [world, bitcoin, sp] = buildHoldingsOverview(
      portfolio,
      prices,
      "1Y",
    ).rows;

    expect(world).toMatchObject({ returnPct: 20, priceChangePct: 12.4 });
    expect(sp).toMatchObject({ returnPct: -10, priceChangePct: -3.1 });
    // No instrument linked: a return, and no price to speak of.
    expect(bitcoin).toMatchObject({ returnPct: 25, priceChangePct: null });
  });

  it("says whether the range has any price to show", () => {
    expect(buildHoldingsOverview(portfolio, prices, "1Y").hasPrices).toBe(true);
    expect(buildHoldingsOverview(portfolio, prices, "5Y").hasPrices).toBe(
      false,
    );
    expect(buildHoldingsOverview(portfolio, {}, "1Y").hasPrices).toBe(false);
  });

  it("leaves out a holding still waiting for its share count", () => {
    const overview = buildHoldingsOverview(
      {
        columns: [
          column("cto", [
            item({ id: "a" }),
            item({ id: "b", needsShareCount: true, marketValue: 0 }),
          ]),
        ],
      },
      {},
      "1Y",
    );
    expect(overview.rows.map((row) => row.id)).toEqual(["a"]);
    expect(overview.rows[0]!.weight).toBe(1);
  });

  it("has no weight to give while nothing is worth anything", () => {
    const overview = buildHoldingsOverview(
      { columns: [column("cto", [item({ marketValue: 0 })])] },
      {},
      "1Y",
    );
    expect(overview.rows[0]!.weight).toBeNull();
  });

  it("gives no return to a holding valued at what it cost", () => {
    const overview = buildHoldingsOverview(
      {
        columns: [
          column("av", [item({ valuationSource: "cost-basis", gainLoss: 0 })]),
        ],
      },
      {},
      "1Y",
    );
    expect(overview.rows[0]!.returnPct).toBeNull();
  });
});

describe("heldSymbols", () => {
  it("names each held instrument once, and none for a line without one", () => {
    expect(
      heldSymbols({
        columns: [
          column("pea", [item(), item({ id: "p2" })]),
          column("crypto", [item({ id: "p3", instrumentSymbol: null })]),
          column("cto", [item({ id: "p4", instrumentSymbol: "VWCE.DE" })]),
        ],
      }),
    ).toEqual(["CW8.PA", "VWCE.DE"]);
  });
});

describe("returnShare", () => {
  it("is the gain over what was put in", () => {
    expect(returnShare(400, 3_800)).toBeCloseTo(0.10526, 5);
    expect(returnShare(-250, 1_000)).toBe(-0.25);
  });

  it("is null with nothing put in", () => {
    expect(returnShare(100, 0)).toBeNull();
  });
});
