import { describe, expect, it } from "vitest";

import { buildBearing } from "./bearing";
import {
  bearingFactIds,
  buildBearingFacts,
  factsOfFamily,
  type BuildBearingFactsInput,
} from "./bearing-facts";
import { buildMonthPulse } from "./month-pulse";
import { findFact, formatFact } from "./month-facts";
import type { AllocationSummary } from "./allocation";
import type { FundCostSummary } from "./fund-costs";
import type { InvestmentReturns } from "./investment-returns";
import type { MonthlySummary } from "./types/database";

function summary(partial: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    income: 3200,
    expenses: 1800,
    savings: 400,
    investments: 300,
    investmentDeployments: 0,
    remaining: 700,
    budgetView: "current",
    expenseBreakdown: [],
    savingsBreakdown: [],
    investmentBreakdown: [],
    investmentDeploymentBreakdown: [],
    ...partial,
  };
}

function pulse(onHand: number | null = 4000) {
  return buildMonthPulse({
    onHand,
    committed: 600,
    arriving: 0,
    flows: { income: 3200, expenses: 1800, savings: 400, transfers: 0 },
    openingBalance: 3200,
    cap: null,
  });
}

function returns(partial: Partial<InvestmentReturns["total"]> = {}) {
  return {
    wallets: [],
    total: {
      rate: 0.074,
      invested: 10000,
      currentValue: 12000,
      absoluteGain: 2000,
      daysHeld: 800,
      unavailableReason: null,
      ...partial,
    },
  } satisfies InvestmentReturns;
}

function costs(partial: Partial<FundCostSummary> = {}): FundCostSummary {
  return {
    rows: [],
    totalAnnualCost: 96,
    coveredValue: 12000,
    uncoveredValue: 0,
    weightedAverage: 0.008,
    cheapest: null,
    costAtCheapest: null,
    missingCount: 0,
    ...partial,
  };
}

function allocation(partial: Partial<AllocationSummary> = {}): AllocationSummary {
  return {
    rows: [
      {
        walletId: "pea",
        value: 8000,
        currentWeight: 0.66,
        targetWeight: 0.6,
        driftPoints: 6.2,
        gap: 800,
        status: "over",
      },
      {
        walletId: "cto",
        value: 4000,
        currentWeight: 0.34,
        targetWeight: 0.4,
        driftPoints: -6.2,
        gap: -800,
        status: "under",
      },
    ],
    total: 12000,
    needsRebalance: true,
    targetCoverage: 1,
    ...partial,
  };
}

function input(
  partial: Partial<BuildBearingFactsInput> = {},
): BuildBearingFactsInput {
  return {
    asOf: "2026-09-09",
    bearing: buildBearing({
      onHand: 4000,
      positions: [
        { name: "World ETF", marketValue: 8000 },
        { name: "Bitcoin", marketValue: 4000 },
      ],
    }),
    pulse: pulse(),
    summary: summary(),
    comparison: null,
    closeSummary: null,
    unrecordedCap: null,
    projection: null,
    runway: null,
    trend: [],
    returns: returns(),
    allocation: allocation(),
    costs: costs(),
    contributionPace: 500,
    inboxPending: 0,
    ...partial,
  };
}

describe("buildBearingFacts", () => {
  describe("the whole position", () => {
    it("carries the no-debts caveat on the datum itself", () => {
      // Not in a comment, and not only on the tile: the note travels with the
      // figure so the model reading the pack is told the same thing the
      // reader is.
      const fact = findFact(buildBearingFacts(input()), "net-position");

      expect(fact!.value).toBe(16000);
      expect(fact!.note).toContain("no debts");
    });

    it("reports the net position as missing, not zero, without a balance", () => {
      const pack = buildBearingFacts(
        input({
          bearing: buildBearing({
            onHand: null,
            positions: [{ name: "World ETF", marketValue: 8000 }],
          }),
          pulse: pulse(null),
        }),
      );

      expect(bearingFactIds(pack).has("net-position")).toBe(false);
      expect(pack.missing).toContainEqual(
        expect.objectContaining({ id: "net-position", why: "no-bank" }),
      );
    });

    it("calls the invested share neither good nor bad", () => {
      // More invested is more growth and less reachable. Which of those a
      // person needs is not something this app knows, and a sense of
      // up-is-good would have a model congratulating somebody for having no
      // accessible cash.
      expect(findFact(buildBearingFacts(input()), "invested-share")).toMatchObject(
        { sense: "neutral", value: 75 },
      );
    });
  });

  describe("the wallets", () => {
    it("gives the return as points, not a fraction", () => {
      expect(findFact(buildBearingFacts(input()), "wallet-return")!.value).toBe(
        7.4,
      );
    });

    it("says why there is no return rather than showing nothing", () => {
      const pack = buildBearingFacts(
        input({ returns: returns({ rate: null, unavailableReason: "too-short" }) }),
      );

      expect(pack.missing).toContainEqual(
        expect.objectContaining({ id: "wallet-return", why: "too-short" }),
      );
    });

    it("says nothing is invested when nothing is", () => {
      const pack = buildBearingFacts(
        input({
          bearing: buildBearing({ onHand: 4000, positions: [] }),
          returns: returns({ invested: 0, currentValue: 0, absoluteGain: 0 }),
        }),
      );

      expect(pack.missing).toContainEqual(
        expect.objectContaining({
          id: "wallet-return",
          why: "nothing-invested",
        }),
      );
      expect(bearingFactIds(pack).has("invested")).toBe(false);
    });

    it("reports the largest drift as a positive number of points", () => {
      // Which way it drifted is the tile's business. The pack states the size.
      expect(findFact(buildBearingFacts(input()), "wallet-drift")).toMatchObject(
        { value: 6.2, sense: "up-is-bad" },
      );
    });

    it("defers to buildAllocation on whether drift is worth measuring", () => {
      const pack = buildBearingFacts(
        input({ allocation: allocation({ needsRebalance: false }) }),
      );

      expect(pack.missing).toContainEqual(
        expect.objectContaining({ id: "wallet-drift", why: "no-target" }),
      );
    });

    it("flags the cost drag as partial when a charge is missing", () => {
      const fact = findFact(
        buildBearingFacts(input({ costs: costs({ missingCount: 2 }) })),
        "wallet-drag",
      );

      expect(fact!.note).toContain("2 holdings");
    });

    it("names the heaviest holding in the concentration label", () => {
      const fact = findFact(
        buildBearingFacts(input()),
        "wallet-concentration",
      );

      expect(fact!.label).toContain("World ETF");
      expect(fact!.value).toBe(66.7);
    });
  });

  describe("the overshoot", () => {
    it("is its own figure, so a model need not subtract", () => {
      // The lesson month-facts.ts records: a model that wants "over by" and
      // has only the allowance will point at the allowance and call it the
      // overshoot.
      const pack = buildBearingFacts(
        input({
          unrecordedCap: 200,
          pulse: buildMonthPulse({
            onHand: 3000,
            committed: 0,
            arriving: 0,
            flows: { income: 0, expenses: 0, savings: 0, transfers: 0 },
            openingBalance: 3500,
            cap: 200,
          }),
        }),
      );

      expect(findFact(pack, "unrecorded-so-far")!.value).toBe(500);
      expect(findFact(pack, "unrecorded-over")!.value).toBe(300);
    });

    it("is absent when the allowance is not breached", () => {
      const pack = buildBearingFacts(input({ unrecordedCap: 900 }));

      expect(bearingFactIds(pack).has("unrecorded-over")).toBe(false);
    });
  });

  describe("families", () => {
    it("groups every datum onto a horizon", () => {
      const pack = buildBearingFacts(input({ contributionPace: 500 }));
      const grouped = (
        ["now", "month", "run", "ahead", "wallet"] as const
      ).flatMap((family) => factsOfFamily(pack, family));

      expect(grouped).toHaveLength(pack.facts.length);
    });

    it("puts the wallet figures under the wallet", () => {
      const ids = factsOfFamily(buildBearingFacts(input()), "wallet").map(
        (fact) => fact.id,
      );

      expect(ids).toContain("wallet-return");
      expect(ids).toContain("wallet-drag");
      expect(ids).not.toContain("net-position");
    });
  });

  describe("thin", () => {
    it("is true for an account with nothing in it and nothing recorded", () => {
      const pack = buildBearingFacts(
        input({
          bearing: buildBearing({ onHand: null, positions: [] }),
          pulse: null,
          summary: summary({
            income: 0,
            expenses: 0,
            savings: 0,
            investments: 0,
            remaining: 0,
          }),
          returns: null,
          costs: null,
          allocation: null,
          contributionPace: 0,
        }),
      );

      expect(pack.thin).toBe(true);
    });

    it("is false once anything has been recorded", () => {
      expect(buildBearingFacts(input()).thin).toBe(false);
    });
  });

  describe("months as a unit", () => {
    it("keeps the decimal a count would round away", () => {
      const pack = buildBearingFacts(
        input({
          runway: { monthlyCommitted: 1200, reserve: 5040, months: 4.2 },
        }),
      );
      const fact = findFact(pack, "runway-months")!;

      expect(fact.unit).toBe("months");
      expect(formatFact(fact, (n) => `${n}`)).toBe("4.2 months");
    });
  });

  it("labels in the language it was asked for", () => {
    const french = buildBearingFacts(input({ locale: "fr" }));
    const english = buildBearingFacts(input());

    expect(findFact(french, "net-position")!.label).toBe("Tout, additionné");
    // Same vocabulary of ids whichever language: the pack is what the model
    // may name, and that must not depend on who is reading.
    expect(bearingFactIds(french)).toEqual(bearingFactIds(english));
  });
});
