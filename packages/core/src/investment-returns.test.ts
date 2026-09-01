import { describe, expect, it } from "vitest";

import {
  buildInvestmentReturns,
  returnUnavailableLabel,
} from "./investment-returns";
import type {
  InvestmentColumnSummary,
  InvestmentPortfolioSummary,
} from "./investment-positions";
import type { TransactionWithCategory } from "./types/database";

let sequence = 0;

/** A deployment: the buy side, which is the cashflow a return is built from. */
function buy(
  occurredOn: string,
  amount: number,
  categoryName = "PEA",
): TransactionWithCategory {
  sequence += 1;
  return {
    id: `tx-${sequence}`,
    user_id: "user-1",
    category_id: "cat-1",
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount,
    note: null,
    created_at: `${occurredOn}T10:00:00.000Z`,
    categories: {
      name: categoryName,
      type: "investment",
      icon: null,
      counts_toward_summary: false,
    },
  };
}

/** The budget-side transfer, which must not be counted as a second cashflow. */
function transfer(
  occurredOn: string,
  amount: number,
  categoryName = "PEA",
): TransactionWithCategory {
  return {
    ...buy(occurredOn, amount, categoryName),
    categories: {
      name: categoryName,
      type: "investment",
      icon: null,
      counts_toward_summary: true,
    },
  };
}

function column(
  walletId: InvestmentColumnSummary["walletId"],
  totalInvested: number,
  totalMarketValue: number,
): InvestmentColumnSummary {
  return {
    walletId,
    items: [],
    totalInvested,
    totalMarketValue,
    totalGainLoss: totalMarketValue - totalInvested,
    hasMarketSnapshot: true,
    chartPoints: [],
  };
}

function portfolio(
  columns: InvestmentColumnSummary[],
): InvestmentPortfolioSummary {
  const totalInvested = columns.reduce((s, c) => s + c.totalInvested, 0);
  const totalMarketValue = columns.reduce((s, c) => s + c.totalMarketValue, 0);
  return {
    columns,
    totalInvested,
    totalMarketValue,
    totalGainLoss: totalMarketValue - totalInvested,
    hasMarketSnapshot: true,
  };
}

describe("buildInvestmentReturns", () => {
  it("computes a rate per wallet from its dated buys", () => {
    const returns = buildInvestmentReturns(
      [buy("2025-01-01", 1000)],
      portfolio([column("pea", 1000, 1100)]),
      "2026-01-01",
    );

    const pea = returns.wallets.find((row) => row.walletId === "pea")!;
    expect(pea.invested).toBe(1000);
    expect(pea.currentValue).toBe(1100);
    expect(pea.rate).toBeCloseTo(0.1, 3);
  });

  it("ignores the budget-side transfer so money is not counted twice", () => {
    const returns = buildInvestmentReturns(
      [buy("2025-01-01", 1000), transfer("2025-01-01", 1000)],
      portfolio([column("pea", 1000, 1100)]),
      "2026-01-01",
    );

    expect(returns.wallets.find((r) => r.walletId === "pea")!.invested).toBe(
      1000,
    );
  });

  it("reports every wallet, including untouched ones", () => {
    const returns = buildInvestmentReturns(
      [buy("2025-01-01", 1000)],
      portfolio([
        column("pea", 1000, 1100),
        column("cto", 0, 0),
        column("crypto", 0, 0),
      ]),
      "2026-01-01",
    );

    expect(returns.wallets).toHaveLength(3);
    const cto = returns.wallets.find((row) => row.walletId === "cto")!;
    expect(cto.rate).toBeNull();
    expect(cto.unavailableReason).toBe("no-contributions");
  });

  it("keeps invested consistent with the portfolio when a position has an opening balance", () => {
    // 1,000 of tracked buys but the portfolio says 3,000 was invested.
    const returns = buildInvestmentReturns(
      [buy("2025-06-01", 1000)],
      portfolio([column("pea", 3000, 3300)]),
      "2026-01-01",
    );

    const pea = returns.wallets.find((row) => row.walletId === "pea")!;
    expect(pea.invested).toBe(3000);
    expect(pea.rate).not.toBeNull();
  });

  it("does not invent a contribution when the totals already agree", () => {
    const returns = buildInvestmentReturns(
      [buy("2025-01-01", 600), buy("2025-07-01", 400)],
      portfolio([column("pea", 1000, 1100)]),
      "2026-01-01",
    );

    expect(returns.wallets.find((r) => r.walletId === "pea")!.invested).toBe(
      1000,
    );
  });

  it("splits buys across wallets by category name", () => {
    const returns = buildInvestmentReturns(
      [buy("2025-01-01", 1000, "PEA"), buy("2025-01-01", 500, "Crypto")],
      portfolio([column("pea", 1000, 1100), column("crypto", 500, 700)]),
      "2026-01-01",
    );

    expect(returns.wallets.find((r) => r.walletId === "pea")!.invested).toBe(
      1000,
    );
    expect(returns.wallets.find((r) => r.walletId === "crypto")!.invested).toBe(
      500,
    );
  });

  it("computes a portfolio rate across every wallet", () => {
    const returns = buildInvestmentReturns(
      [buy("2025-01-01", 1000, "PEA"), buy("2025-01-01", 1000, "Crypto")],
      portfolio([column("pea", 1000, 1100), column("crypto", 1000, 1100)]),
      "2026-01-01",
    );

    expect(returns.total.invested).toBe(2000);
    expect(returns.total.currentValue).toBe(2200);
    expect(returns.total.rate).toBeCloseTo(0.1, 3);
  });

  it("distinguishes a drip from a lump sum at the portfolio level", () => {
    const lump = buildInvestmentReturns(
      [buy("2025-01-01", 1200)],
      portfolio([column("pea", 1200, 1260)]),
      "2026-01-01",
    );

    const drip = buildInvestmentReturns(
      Array.from({ length: 12 }, (_, index) =>
        buy(`2025-${String(index + 1).padStart(2, "0")}-01`, 100),
      ),
      portfolio([column("pea", 1200, 1260)]),
      "2026-01-01",
    );

    // Same €60 gain, but the drip had less money at risk for less time.
    expect(drip.total.rate!).toBeGreaterThan(lump.total.rate!);
  });

  it("reports the absolute gain even when no rate can be computed", () => {
    const returns = buildInvestmentReturns(
      [buy("2026-01-01", 100)],
      portfolio([column("pea", 100, 120)]),
      "2026-01-10",
    );

    const pea = returns.wallets.find((row) => row.walletId === "pea")!;
    expect(pea.absoluteGain).toBe(20);
    expect(pea.rate).toBeNull();
    expect(pea.unavailableReason).toBe("too-short");
  });
});

describe("returnUnavailableLabel", () => {
  it("explains each reason a rate is missing", () => {
    expect(returnUnavailableLabel("no-contributions")).toBe(
      "No contributions yet",
    );
    expect(returnUnavailableLabel("too-short")).toBe("Too new to annualise");
    expect(returnUnavailableLabel("not-solvable")).toBe("Not enough history");
  });

  it("says nothing when a rate is available", () => {
    expect(returnUnavailableLabel(null)).toBeNull();
  });
});
