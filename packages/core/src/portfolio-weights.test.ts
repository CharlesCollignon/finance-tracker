import { describe, expect, it } from "vitest";

import { holdingWeights } from "./portfolio-weights";

describe("holdingWeights", () => {
  it("weighs each holding against the total it was given, largest first", () => {
    const rows = holdingWeights([
      { id: "b", label: "World", value: 2_000 },
      { id: "a", label: "Bitcoin", value: 6_000 },
      { id: "c", label: "Bonds", value: 2_000 },
    ]);

    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(rows[0]!.weight).toBeCloseTo(0.6);
    expect(rows.reduce((sum, row) => sum + row.weight, 0)).toBeCloseTo(1);
  });

  it("drops holdings worth nothing rather than drawing an empty bar for them", () => {
    const rows = holdingWeights([
      { id: "a", label: "World", value: 100 },
      { id: "b", label: "Sold out", value: 0 },
      { id: "c", label: "Underwater", value: -50 },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.weight).toBe(1);
  });

  it("is empty when nothing positive was passed, rather than dividing by zero", () => {
    expect(holdingWeights([])).toEqual([]);
    expect(holdingWeights([{ id: "a", label: "Nothing", value: 0 }])).toEqual(
      [],
    );
  });
});
