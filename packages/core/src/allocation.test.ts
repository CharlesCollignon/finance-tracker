import { describe, expect, it } from "vitest";

import {
  buildAllocation,
  defaultTargets,
  formatWeight,
  suggestContributionSplit,
  type WalletTarget,
} from "./allocation";

const BALANCED: WalletTarget[] = [
  { walletId: "pea", targetWeight: 0.6 },
  { walletId: "cto", targetWeight: 0.3 },
  { walletId: "crypto", targetWeight: 0.1 },
];

function values(pea: number, cto: number, crypto: number) {
  return [
    { walletId: "pea" as const, value: pea },
    { walletId: "cto" as const, value: cto },
    { walletId: "crypto" as const, value: crypto },
  ];
}

describe("buildAllocation", () => {
  it("reports weights against targets", () => {
    const summary = buildAllocation(values(6000, 3000, 1000), BALANCED);
    const pea = summary.rows.find((row) => row.walletId === "pea")!;

    expect(summary.total).toBe(10000);
    expect(pea.currentWeight).toBeCloseTo(0.6, 6);
    expect(pea.driftPoints).toBeCloseTo(0, 6);
    expect(pea.status).toBe("on-target");
    expect(summary.needsRebalance).toBe(false);
  });

  it("flags the drifted wallets from the audit's example", () => {
    // 52 / 28 / 20 against a 60 / 30 / 10 target.
    const summary = buildAllocation(values(5200, 2800, 2000), BALANCED);

    const byWallet = new Map(summary.rows.map((row) => [row.walletId, row]));
    expect(byWallet.get("pea")!.status).toBe("under");
    expect(byWallet.get("pea")!.driftPoints).toBeCloseTo(-8, 6);
    expect(byWallet.get("crypto")!.status).toBe("over");
    expect(byWallet.get("crypto")!.driftPoints).toBeCloseTo(10, 6);
    expect(summary.needsRebalance).toBe(true);
  });

  it("treats a small drift as on-target", () => {
    // 62 / 29 / 9 is within the tolerance band everywhere.
    const summary = buildAllocation(values(6200, 2900, 900), BALANCED);
    expect(summary.needsRebalance).toBe(false);
  });

  it("reports the euros needed to sit exactly on target", () => {
    const summary = buildAllocation(values(5200, 2800, 2000), BALANCED);
    const pea = summary.rows.find((row) => row.walletId === "pea")!;
    // 60% of 10,000 is 6,000, so 800 short.
    expect(pea.gap).toBeCloseTo(800, 6);
  });

  it("refuses to report drift against half-specified targets", () => {
    const summary = buildAllocation(values(6000, 3000, 1000), [
      { walletId: "pea", targetWeight: 0.6 },
    ]);

    expect(summary.rows.every((row) => row.status === "no-target")).toBe(true);
    expect(summary.needsRebalance).toBe(false);
    expect(summary.targetCoverage).toBeCloseTo(0.6, 6);
  });

  it("handles an empty portfolio without dividing by zero", () => {
    const summary = buildAllocation(values(0, 0, 0), BALANCED);
    expect(summary.total).toBe(0);
    expect(summary.rows.every((row) => row.currentWeight === 0)).toBe(true);
  });

  it("includes a wallet the caller did not mention", () => {
    const summary = buildAllocation(
      [{ walletId: "pea", value: 100 }],
      BALANCED,
    );
    expect(summary.rows).toHaveLength(3);
    expect(
      summary.rows.find((row) => row.walletId === "crypto")!.value,
    ).toBe(0);
  });
});

describe("suggestContributionSplit", () => {
  it("sends new money to the underweight wallet", () => {
    const summary = buildAllocation(values(5200, 2800, 2000), BALANCED);
    const split = suggestContributionSplit(summary, 500);

    const pea = split.find((row) => row.walletId === "pea");
    expect(pea).toBeDefined();
    // Crypto is overweight, so nothing should go there.
    expect(split.find((row) => row.walletId === "crypto")).toBeUndefined();
  });

  it("allocates the whole contribution", () => {
    const summary = buildAllocation(values(5200, 2800, 2000), BALANCED);
    const split = suggestContributionSplit(summary, 500);
    const total = split.reduce((sum, row) => sum + row.amount, 0);

    expect(total).toBeCloseTo(500, 2);
  });

  it("splits by target weight when the portfolio is already balanced", () => {
    const summary = buildAllocation(values(6000, 3000, 1000), BALANCED);
    const split = suggestContributionSplit(summary, 1000);
    const byWallet = new Map(split.map((row) => [row.walletId, row.amount]));

    expect(byWallet.get("pea")).toBeCloseTo(600, 1);
    expect(byWallet.get("cto")).toBeCloseTo(300, 1);
    expect(byWallet.get("crypto")).toBeCloseTo(100, 1);
  });

  it("splits by target weight for a first contribution into nothing", () => {
    const summary = buildAllocation(values(0, 0, 0), BALANCED);
    const split = suggestContributionSplit(summary, 1000);
    const byWallet = new Map(split.map((row) => [row.walletId, row.amount]));

    expect(byWallet.get("pea")).toBeCloseTo(600, 1);
  });

  it("fills the shortfall proportionally when money is short", () => {
    // PEA is 800 short, CTO 200 short, but only 500 is available.
    const summary = buildAllocation(values(5200, 2800, 2000), BALANCED);
    const split = suggestContributionSplit(summary, 500);
    const byWallet = new Map(split.map((row) => [row.walletId, row.amount]));

    const pea = byWallet.get("pea") ?? 0;
    const cto = byWallet.get("cto") ?? 0;
    expect(pea).toBeGreaterThan(cto);
    expect(pea + cto).toBeCloseTo(500, 2);
  });

  it("returns nothing for a non-positive contribution", () => {
    const summary = buildAllocation(values(6000, 3000, 1000), BALANCED);
    expect(suggestContributionSplit(summary, 0)).toEqual([]);
    expect(suggestContributionSplit(summary, -100)).toEqual([]);
  });

  it("returns nothing when no targets are set", () => {
    const summary = buildAllocation(values(6000, 3000, 1000), []);
    expect(suggestContributionSplit(summary, 500)).toEqual([]);
  });
});

describe("defaultTargets", () => {
  it("offers an even split across every wallet", () => {
    const targets = defaultTargets();
    expect(targets).toHaveLength(3);
    expect(targets.every((target) => target.targetWeight === 0.33)).toBe(true);
  });
});

describe("formatWeight", () => {
  it("renders a fraction as a percentage", () => {
    expect(formatWeight(0.6)).toBe("60%");
  });

  it("renders an absent target as a dash", () => {
    expect(formatWeight(null)).toBe("—");
  });
});
