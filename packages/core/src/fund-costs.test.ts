import { describe, expect, it } from "vitest";

import {
  buildFundCosts,
  chargeLookupUrl,
  chargeToInput,
  costOverYears,
  formatCharge,
  parseChargeInput,
  savingAtCheapest,
  type PositionCostInput,
  type WrapperFees,
} from "./fund-costs";

function position(
  name: string,
  marketValue: number,
  ongoingCharge: number | null,
): PositionCostInput {
  return {
    positionId: `pos-${name}`,
    name,
    walletId: "pea",
    marketValue,
    ongoingCharge,
  };
}

function inWallet(
  base: PositionCostInput,
  walletId: PositionCostInput["walletId"],
): PositionCostInput {
  return { ...base, walletId };
}

describe("buildFundCosts", () => {
  it("turns a percentage into a euro figure", () => {
    const summary = buildFundCosts([position("World", 20000, 0.0038)]);
    expect(summary.rows[0]!.annualCost).toBe(76);
    expect(summary.totalAnnualCost).toBe(76);
  });

  it("totals across positions", () => {
    const summary = buildFundCosts([
      position("World", 20000, 0.002),
      position("Emerging", 5000, 0.0018),
    ]);
    expect(summary.totalAnnualCost).toBe(49);
  });

  it("reports how much value has no charge recorded", () => {
    const summary = buildFundCosts([
      position("World", 20000, 0.002),
      position("Mystery", 5000, null),
    ]);

    expect(summary.coveredValue).toBe(20000);
    expect(summary.uncoveredValue).toBe(5000);
    expect(summary.missingCount).toBe(1);
  });

  it("leaves the cost of an unpriced position null rather than zero", () => {
    const summary = buildFundCosts([position("Mystery", 5000, null)]);
    expect(summary.rows[0]!.annualCost).toBeNull();
    expect(summary.totalAnnualCost).toBe(0);
  });

  it("weights the average by value, not by position count", () => {
    const summary = buildFundCosts([
      position("Big", 90000, 0.001),
      position("Small", 10000, 0.005),
    ]);

    // (0.001×90000 + 0.005×10000) / 100000 = 0.0014
    expect(summary.weightedAverage).toBeCloseTo(0.0014, 6);
  });

  it("ignores a worthless position in the average", () => {
    const summary = buildFundCosts([
      position("Held", 10000, 0.002),
      position("Closed", 0, 0.009),
    ]);

    expect(summary.weightedAverage).toBeCloseTo(0.002, 6);
  });

  it("finds the cheapest holding the user actually owns", () => {
    const summary = buildFundCosts([
      position("World", 20000, 0.002),
      position("Cheap", 5000, 0.0007),
      position("Pricey", 5000, 0.005),
    ]);

    expect(summary.cheapest).toEqual({ name: "Cheap", ongoingCharge: 0.0007 });
  });

  it("costs the whole covered value at the cheapest rate", () => {
    const summary = buildFundCosts([
      position("World", 20000, 0.002),
      position("Cheap", 5000, 0.0007),
    ]);

    // 25,000 × 0.07%
    expect(summary.costAtCheapest).toBe(17.5);
  });

  it("has no cheapest when nothing has a charge", () => {
    const summary = buildFundCosts([position("Mystery", 5000, null)]);
    expect(summary.cheapest).toBeNull();
    expect(summary.costAtCheapest).toBeNull();
    expect(summary.weightedAverage).toBeNull();
  });

  it("handles an empty portfolio", () => {
    const summary = buildFundCosts([]);
    expect(summary.totalAnnualCost).toBe(0);
    expect(summary.coveredValue).toBe(0);
    expect(summary.cheapest).toBeNull();
  });

  it("treats a zero charge as recorded, not missing", () => {
    const summary = buildFundCosts([position("Free", 1000, 0)]);
    expect(summary.missingCount).toBe(0);
    expect(summary.rows[0]!.annualCost).toBe(0);
    expect(summary.cheapest?.ongoingCharge).toBe(0);
  });
});

describe("savingAtCheapest", () => {
  it("reports what matching the cheapest holding would save", () => {
    const summary = buildFundCosts([
      position("World", 20000, 0.002),
      position("Cheap", 5000, 0.0007),
    ]);

    // €40 + €3.50 = €43.50 today; €25,000 at 0.07% would be €17.50.
    expect(savingAtCheapest(summary)).toBe(26);
  });

  it("says nothing when everything already sits at the cheapest rate", () => {
    const summary = buildFundCosts([
      position("A", 10000, 0.001),
      position("B", 10000, 0.001),
    ]);
    expect(savingAtCheapest(summary)).toBeNull();
  });

  it("says nothing when the saving is pennies", () => {
    const summary = buildFundCosts([
      position("A", 1000, 0.001),
      position("B", 1000, 0.0009),
    ]);
    expect(savingAtCheapest(summary)).toBeNull();
  });

  it("says nothing when there is no charge data", () => {
    expect(savingAtCheapest(buildFundCosts([position("X", 100, null)]))).toBeNull();
  });
});

describe("costOverYears", () => {
  it("multiplies out without assuming a return", () => {
    expect(costOverYears(41, 10)).toBe(410);
  });
});

describe("formatCharge", () => {
  it("renders a fraction as a trimmed percentage", () => {
    expect(formatCharge(0.002)).toBe("0.2%");
    expect(formatCharge(0.0038)).toBe("0.38%");
    expect(formatCharge(0.00065)).toBe("0.065%");
  });

  it("renders zero and absent distinctly", () => {
    expect(formatCharge(0)).toBe("0%");
    expect(formatCharge(null)).toBe("—");
  });
});

describe("parseChargeInput", () => {
  it("reads what a user types", () => {
    expect(parseChargeInput("0.20")).toBeCloseTo(0.002, 6);
    expect(parseChargeInput("0,20")).toBeCloseTo(0.002, 6);
    expect(parseChargeInput("0.20%")).toBeCloseTo(0.002, 6);
    expect(parseChargeInput(" 0.38 ")).toBeCloseTo(0.0038, 6);
  });

  it("keeps a thousandth of a percent", () => {
    expect(parseChargeInput("0.065")).toBeCloseTo(0.00065, 7);
  });

  it("returns null for nothing or nonsense", () => {
    expect(parseChargeInput("")).toBeNull();
    expect(parseChargeInput("   ")).toBeNull();
    expect(parseChargeInput("abc")).toBeNull();
    expect(parseChargeInput("-1")).toBeNull();
  });

  it("round-trips through the input representation", () => {
    expect(parseChargeInput(chargeToInput(0.0038))).toBeCloseTo(0.0038, 6);
  });
});

describe("chargeToInput", () => {
  it("renders the stored fraction as a percentage figure", () => {
    expect(chargeToInput(0.002)).toBe("0.2");
    expect(chargeToInput(0.0038)).toBe("0.38");
  });

  it("is empty when nothing is recorded", () => {
    expect(chargeToInput(null)).toBe("");
  });
});

describe("chargeLookupUrl", () => {
  it("links to a search for the instrument", () => {
    expect(chargeLookupUrl("IWDA.AS", null)).toContain("query=IWDA.AS");
  });

  it("falls back to the instrument name", () => {
    expect(chargeLookupUrl(null, "iShares Core MSCI World")).toContain(
      "iShares%20Core%20MSCI%20World",
    );
  });

  it("returns nothing when there is nothing to look up", () => {
    expect(chargeLookupUrl(null, null)).toBeNull();
  });
});

/**
 * The envelope's own fee.
 *
 * An assurance-vie charges on the whole contract, so the same fund costs more
 * there than in a PEA. These assert that the two layers stay separable — the
 * fund-only figures are what someone compares between funds, the all-in
 * figures are what actually leaves the account.
 */
describe("buildFundCosts with envelope fees", () => {
  const AV_FEES: WrapperFees = { av: 0.006 };

  it("leaves the fund figures alone when no envelope charges", () => {
    const withoutFees = buildFundCosts([position("World", 20000, 0.002)]);
    const withFees = buildFundCosts([position("World", 20000, 0.002)], AV_FEES);

    // The position is in a PEA, which takes nothing.
    expect(withFees.totalAnnualCost).toBe(withoutFees.totalAnnualCost);
    expect(withFees.weightedAverage).toBe(withoutFees.weightedAverage);
    expect(withFees.envelopeAnnualCost).toBe(0);
    expect(withFees.allInAnnualCost).toBe(withoutFees.totalAnnualCost);
  });

  it("stacks the envelope fee on top of the fund charge", () => {
    const summary = buildFundCosts(
      [inWallet(position("Unit", 10000, 0.002), "av")],
      AV_FEES,
    );

    expect(summary.rows[0]!.ongoingCharge).toBe(0.002);
    expect(summary.rows[0]!.wrapperFee).toBe(0.006);
    expect(summary.rows[0]!.effectiveCharge).toBeCloseTo(0.008, 6);

    expect(summary.rows[0]!.annualCost).toBe(20);
    expect(summary.rows[0]!.wrapperCost).toBe(60);
    expect(summary.rows[0]!.allInCost).toBe(80);

    // The comparison that matters: four times the fund's own charge.
    expect(summary.weightedAverage).toBeCloseTo(0.002, 6);
    expect(summary.weightedAllIn).toBeCloseTo(0.008, 6);
    expect(summary.allInAnnualCost).toBe(80);
  });

  /**
   * The envelope fee is known from the wallet, so it applies to value whose
   * own ongoing charge was never entered. Its base is therefore wider than
   * the fund figures' base, and conflating the two would understate the cost
   * of exactly the portfolio that needs the warning most.
   */
  it("charges the envelope on value whose fund charge is unknown", () => {
    const summary = buildFundCosts(
      [
        inWallet(position("Known", 10000, 0.002), "av"),
        inWallet(position("Unknown", 10000, null), "av"),
      ],
      AV_FEES,
    );

    expect(summary.coveredValue).toBe(10000);
    expect(summary.uncoveredValue).toBe(10000);
    expect(summary.missingCount).toBe(1);

    // Both positions pay the envelope, only one has a fund charge on record.
    expect(summary.envelopeCoveredValue).toBe(20000);
    expect(summary.envelopeAnnualCost).toBe(120);
    expect(summary.totalAnnualCost).toBe(20);
    expect(summary.allInAnnualCost).toBe(140);
  });

  it("weights the envelope fee across wallets that charge differently", () => {
    const summary = buildFundCosts(
      [
        inWallet(position("Contract", 30000, 0.002), "av"),
        position("PEA fund", 10000, 0.002),
      ],
      AV_FEES,
    );

    expect(summary.envelopeCoveredValue).toBe(30000);
    expect(summary.weightedEnvelopeFee).toBeCloseTo(0.006, 6);
    // All-in is weighted over held value, so the PEA fund dilutes it.
    expect(summary.weightedAllIn).toBeCloseTo(0.0065, 6);
  });

  it("ignores an envelope fee on a position worth nothing", () => {
    const summary = buildFundCosts(
      [inWallet(position("Empty", 0, 0.002), "av")],
      AV_FEES,
    );
    expect(summary.envelopeCoveredValue).toBe(0);
    expect(summary.envelopeAnnualCost).toBe(0);
    expect(summary.weightedEnvelopeFee).toBeNull();
  });
});
