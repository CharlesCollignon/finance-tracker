import { describe, expect, it } from "vitest";

import {
  MAX_SATELLITE_WEIGHT,
  MIN_LEAD_WEIGHT,
  MIN_MEANINGFUL_MOVE,
  SUGGESTION_ROLES,
  WEIGHT_CLASSES,
  buildArbitrage,
  buildTargetAllocation,
  defaultAssignments,
  type RoleAssignment,
} from "./look-through-target";
import { buildLookThrough } from "./look-through";
import { READING_VERSION, type InstrumentReading } from "./instrument-reading";

const WORLD = "FR001400U5Q4"; // DCAM, MSCI World, PEA
const SP500 = "FR0013412285"; // PE500, S&P 500, PEA
const EMERGING = "FR0013412020"; // PAEEM, MSCI EM, PEA
const EUROPE = "FR0011550193"; // ETZ, STOXX Europe 600, PEA
const SMALL = "LU1681038672"; // RS2K, Russell 2000, PEA
const SWDA = "IE00B4L5Y983"; // physical MSCI World — CTO only

function assign(
  isin: string,
  weightClass: RoleAssignment["weightClass"],
  partial: Partial<RoleAssignment> = {},
): RoleAssignment {
  return {
    isin,
    role: "core-world",
    wallet: "pea",
    weightClass,
    ...partial,
  };
}

function sum(weights: number[]): number {
  return weights.reduce((total, weight) => total + weight, 0);
}

describe("buildTargetAllocation", () => {
  it("adds up to the whole portfolio", () => {
    const target = buildTargetAllocation([
      assign(WORLD, "lead"),
      assign(EMERGING, "support", { role: "emerging" }),
      assign(SMALL, "satellite", { role: "small-cap" }),
    ]);

    expect(sum(target.rows.map((row) => row.weight))).toBeCloseTo(1, 6);
    expect(target.coverage).toBeCloseTo(1, 6);
  });

  it("gives the lead the largest share", () => {
    const target = buildTargetAllocation([
      assign(WORLD, "lead"),
      assign(EMERGING, "support", { role: "emerging" }),
      assign(SMALL, "satellite", { role: "small-cap" }),
    ]);

    expect(target.rows[0]!.isin).toBe(WORLD);
    expect(target.rows[0]!.weight).toBeGreaterThanOrEqual(MIN_LEAD_WEIGHT);
  });

  it("keeps a lead above the floor even against many satellites", () => {
    const target = buildTargetAllocation([
      assign(WORLD, "lead"),
      assign(SP500, "satellite", { role: "us-large" }),
      assign(EMERGING, "satellite", { role: "emerging" }),
      assign(EUROPE, "satellite", { role: "europe" }),
      assign(SMALL, "satellite", { role: "small-cap" }),
    ]);

    const lead = target.rows.find((row) => row.isin === WORLD)!;
    expect(lead.weight).toBeGreaterThanOrEqual(MIN_LEAD_WEIGHT - 1e-9);
    expect(sum(target.rows.map((row) => row.weight))).toBeCloseTo(1, 6);
  });

  it("never lets a satellite grow into a core holding", () => {
    const target = buildTargetAllocation([
      assign(WORLD, "lead"),
      assign(SP500, "satellite", { role: "us-large" }),
    ]);

    const satellite = target.rows.find((row) => row.isin === SP500)!;
    expect(satellite.weight).toBeLessThanOrEqual(MAX_SATELLITE_WEIGHT + 1e-9);
    expect(sum(target.rows.map((row) => row.weight))).toBeCloseTo(1, 6);
  });

  it("still totals one when every row is a capped satellite", () => {
    const target = buildTargetAllocation([
      assign(SP500, "satellite", { role: "us-large" }),
      assign(EMERGING, "satellite", { role: "emerging" }),
    ]);
    expect(sum(target.rows.map((row) => row.weight))).toBeCloseTo(1, 6);
  });

  it("orders by weight, heaviest first", () => {
    const target = buildTargetAllocation([
      assign(SMALL, "satellite", { role: "small-cap" }),
      assign(WORLD, "lead"),
      assign(EMERGING, "support", { role: "emerging" }),
    ]);
    const weights = target.rows.map((row) => row.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  /**
   * The safety property. A model that invents a plausible-looking ISIN must
   * not get a row, and must not get its string rendered anywhere.
   */
  it("drops an instrument the catalogue does not know", () => {
    const target = buildTargetAllocation([
      assign(WORLD, "lead"),
      assign("XX0000000000", "support"),
    ]);

    expect(target.rows.map((row) => row.isin)).toEqual([WORLD]);
    expect(target.dropped).toContainEqual({
      isin: "XX0000000000",
      reason: "not-catalogued",
    });
    expect(sum(target.rows.map((row) => row.weight))).toBeCloseTo(1, 6);
  });

  it("drops a fund placed in a wrapper it cannot sit in", () => {
    const target = buildTargetAllocation([
      assign(WORLD, "lead"),
      // SWDA is physically replicated: legal in a CTO, never in a PEA.
      assign(SWDA, "support", { wallet: "pea" }),
    ]);

    expect(target.dropped).toContainEqual({
      isin: SWDA,
      reason: "wrong-wrapper",
    });
  });

  it("accepts the same fund in a wrapper it can sit in", () => {
    const target = buildTargetAllocation([
      assign(SWDA, "lead", { wallet: "cto" }),
    ]);
    expect(target.rows.map((row) => row.isin)).toEqual([SWDA]);
  });

  it("drops what it was told to exit", () => {
    const target = buildTargetAllocation([
      assign(WORLD, "lead"),
      assign(SP500, "exit", { role: "us-large" }),
    ]);

    expect(target.rows.map((row) => row.isin)).toEqual([WORLD]);
    expect(target.dropped).toContainEqual({ isin: SP500, reason: "exit" });
  });

  it("keeps a trim, smaller than a satellite", () => {
    const target = buildTargetAllocation([
      assign(WORLD, "lead"),
      assign(SP500, "satellite", { role: "us-large" }),
      assign(EMERGING, "trim", { role: "emerging" }),
    ]);

    const satellite = target.rows.find((row) => row.isin === SP500)!;
    const trim = target.rows.find((row) => row.isin === EMERGING)!;
    expect(trim.weight).toBeLessThan(satellite.weight);
    expect(trim.weight).toBeGreaterThan(0);
  });

  it("ignores a repeated instrument rather than double-counting it", () => {
    const target = buildTargetAllocation([
      assign(WORLD, "lead"),
      assign(WORLD, "satellite"),
    ]);
    expect(target.rows).toHaveLength(1);
    expect(target.rows[0]!.weight).toBeCloseTo(1, 6);
  });

  it("is case- and space-insensitive about identifiers", () => {
    const target = buildTargetAllocation([
      assign(`  ${WORLD.toLowerCase()} `, "lead"),
    ]);
    expect(target.rows[0]!.isin).toBe(WORLD);
  });

  it("names funds from the catalogue, not from what it was handed", () => {
    const target = buildTargetAllocation([assign(WORLD, "lead")]);
    expect(target.rows[0]!.name).toBe("Amundi PEA Monde (MSCI World)");
    expect(target.rows[0]!.symbol).toBe("DCAM");
  });

  it("returns nothing at all for nothing at all", () => {
    const target = buildTargetAllocation([]);
    expect(target.rows).toEqual([]);
    expect(target.coverage).toBe(0);
  });

  it("returns nothing when every assignment was dropped", () => {
    const target = buildTargetAllocation([assign("XX0000000000", "lead")]);
    expect(target.rows).toEqual([]);
    expect(target.coverage).toBe(0);
  });

  it("offers a closed vocabulary on both axes", () => {
    expect(WEIGHT_CLASSES).toContain("lead");
    expect(SUGGESTION_ROLES).toContain("core-world");
    expect(new Set(WEIGHT_CLASSES).size).toBe(WEIGHT_CLASSES.length);
    expect(new Set(SUGGESTION_ROLES).size).toBe(SUGGESTION_ROLES.length);
  });
});

describe("defaultAssignments", () => {
  const NOW = new Date("2026-09-14T12:00:00.000Z");

  function reading(isin: string): InstrumentReading {
    return {
      isin,
      ongoingCharge: 0.002,
      currency: "EUR",
      countryWeights: { US: 0.7, FR: 0.03 },
      sectorWeights: { financials: 0.15 },
      topConstituents: [],
      constituentsCoverage: 0,
      sources: [],
      sourcedAt: NOW.toISOString(),
      model: null,
      version: READING_VERSION,
    };
  }

  function lookThroughOf(
    positions: { isin: string | null; walletId: "pea" | "cto" }[],
  ) {
    return buildLookThrough({
      positions: positions.map((position, index) => ({
        positionId: `pos-${index}`,
        name: `Position ${index}`,
        walletId: position.walletId,
        isin: position.isin,
        marketValue: 1000,
        ongoingCharge: null,
      })),
      readings: new Map(
        positions
          .filter((position) => position.isin)
          .map((position) => [position.isin!, reading(position.isin!)]),
      ),
      now: NOW,
    });
  }

  /**
   * This is what the page shows with no API key, with the allowance spent,
   * and before anyone has pressed the button — so it has to produce a valid
   * target on its own.
   */
  it("produces a usable target with no model involved", () => {
    const positions = [
      { isin: WORLD, walletId: "pea" as const },
      { isin: EMERGING, walletId: "pea" as const },
    ];
    const assignments = defaultAssignments(lookThroughOf(positions), positions);
    const target = buildTargetAllocation(assignments);

    expect(target.rows.length).toBeGreaterThan(0);
    expect(sum(target.rows.map((row) => row.weight))).toBeCloseTo(1, 6);
  });

  it("lets a world fund already held take the lead", () => {
    const positions = [
      { isin: SP500, walletId: "pea" as const },
      { isin: WORLD, walletId: "pea" as const },
    ];
    const assignments = defaultAssignments(lookThroughOf(positions), positions);
    const lead = assignments.find((a) => a.weightClass === "lead")!;
    expect(lead.isin).toBe(WORLD);
  });

  it("does not propose something nobody owns when there is no world fund", () => {
    const positions = [{ isin: SP500, walletId: "pea" as const }];
    const assignments = defaultAssignments(lookThroughOf(positions), positions);
    expect(assignments.map((a) => a.isin)).toEqual([SP500]);
    expect(assignments[0]!.weightClass).toBe("lead");
  });

  it("moves a fund to a wrapper it may actually sit in", () => {
    const positions = [{ isin: SWDA, walletId: "pea" as const }];
    const assignments = defaultAssignments(lookThroughOf(positions), positions);
    // Held in a PEA, which it cannot be — so the default puts it where it can.
    expect(assignments[0]!.wallet).not.toBe("pea");
  });

  it("reads a role off the index family", () => {
    const positions = [
      { isin: WORLD, walletId: "pea" as const },
      { isin: EMERGING, walletId: "pea" as const },
      { isin: SMALL, walletId: "pea" as const },
    ];
    const assignments = defaultAssignments(lookThroughOf(positions), positions);
    const byIsin = new Map(assignments.map((a) => [a.isin, a.role]));
    expect(byIsin.get(WORLD)).toBe("core-world");
    expect(byIsin.get(EMERGING)).toBe("emerging");
    expect(byIsin.get(SMALL)).toBe("small-cap");
  });

  it("proposes nothing when nothing held is catalogued", () => {
    const positions = [{ isin: null, walletId: "pea" as const }];
    expect(defaultAssignments(lookThroughOf(positions), positions)).toEqual([]);
  });
});

describe("buildArbitrage", () => {
  const target = buildTargetAllocation([
    assign(WORLD, "lead"),
    assign(EMERGING, "support", { role: "emerging" }),
  ]);

  const held = [
    { isin: WORLD, name: "World", walletId: "pea" as const, marketValue: 2000 },
    {
      isin: EMERGING,
      name: "Emerging",
      walletId: "pea" as const,
      marketValue: 8000,
    },
  ];

  /**
   * A rebalance moves money between holdings, so the moves have to net to
   * nothing. A plan whose buys exceed its sells is a plan that quietly
   * assumes a deposit.
   */
  it("nets to zero", () => {
    const moves = buildArbitrage(target, held, 10000);
    expect(sum(moves.map((move) => move.delta))).toBeCloseTo(0, 6);
  });

  it("buys the underweight and sells the overweight", () => {
    const moves = buildArbitrage(target, held, 10000);
    const world = moves.find((move) => move.isin === WORLD)!;
    const emerging = moves.find((move) => move.isin === EMERGING)!;

    expect(world.delta).toBeGreaterThan(0);
    expect(emerging.delta).toBeLessThan(0);
    expect(world.currentValue).toBe(2000);
  });

  it("sells to zero anything the target does not mention", () => {
    const moves = buildArbitrage(
      target,
      [
        ...held,
        {
          isin: SMALL,
          name: "Small caps",
          walletId: "pea" as const,
          marketValue: 3000,
        },
      ],
      13000,
    );

    const small = moves.find((move) => move.isin === SMALL)!;
    expect(small.targetValue).toBe(0);
    expect(small.delta).toBe(-3000);
  });

  it("mentions an untracked holding even with no identifier", () => {
    const moves = buildArbitrage(
      target,
      [
        ...held,
        {
          isin: null,
          name: "Mystery",
          walletId: "cto" as const,
          marketValue: 3000,
        },
      ],
      13000,
    );
    expect(moves.some((move) => move.name === "Mystery")).toBe(true);
  });

  it("stays quiet about a move too small to place", () => {
    // Sitting just inside the target, by less than the threshold. Derived
    // from the target rather than assumed: the class ratios are this
    // module's business and a test that hardcodes them tests the wrong thing.
    const total = 10000;
    const drift = MIN_MEANINGFUL_MOVE / 2;
    const moves = buildArbitrage(
      target,
      target.rows.map((row, index) => ({
        isin: row.isin,
        name: row.name,
        walletId: "pea" as const,
        marketValue:
          row.weight * total + (index === 0 ? drift : -drift),
      })),
      total,
    );
    expect(moves).toEqual([]);
  });

  it("puts the largest move first", () => {
    const moves = buildArbitrage(target, held, 10000);
    const sizes = moves.map((move) => Math.abs(move.delta));
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it("says nothing about a portfolio worth nothing", () => {
    expect(buildArbitrage(target, [], 0)).toEqual([]);
  });

  it("buys the whole target from an empty portfolio", () => {
    const moves = buildArbitrage(target, [], 10000);
    // Nothing held, so every move is a purchase and they sum to the total.
    expect(moves.every((move) => move.delta > 0)).toBe(true);
    expect(sum(moves.map((move) => move.delta))).toBeCloseTo(10000, 6);
  });
});
