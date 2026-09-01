import { describe, expect, it } from "vitest";

import {
  PEA_CONTRIBUTION_CEILING,
  buildPeaStatus,
  peaMaturityHint,
} from "./pea";

describe("buildPeaStatus", () => {
  it("reports headroom against the statutory ceiling", () => {
    const status = buildPeaStatus(40_000, null, "2026-09-01");

    expect(status.ceiling).toBe(PEA_CONTRIBUTION_CEILING);
    expect(status.contributed).toBe(40_000);
    expect(status.headroom).toBe(110_000);
    expect(status.ratio).toBeCloseTo(40_000 / 150_000, 6);
  });

  it("flags a plan close to the ceiling", () => {
    expect(buildPeaStatus(140_000, null, "2026-09-01").nearCeiling).toBe(true);
    expect(buildPeaStatus(100_000, null, "2026-09-01").nearCeiling).toBe(false);
  });

  it("flags an over-contributed plan and clamps headroom at zero", () => {
    const status = buildPeaStatus(160_000, null, "2026-09-01");

    expect(status.overCeiling).toBe(true);
    expect(status.headroom).toBe(0);
    expect(status.ratio).toBeGreaterThan(1);
  });

  it("ignores a negative contribution total", () => {
    expect(buildPeaStatus(-500, null, "2026-09-01").contributed).toBe(0);
  });

  it("accepts a custom ceiling for a PEA-PME or a rule change", () => {
    const status = buildPeaStatus(10_000, null, "2026-09-01", 20_000);
    expect(status.headroom).toBe(10_000);
  });

  it("leaves the clock unknown when the opening date is not set", () => {
    const status = buildPeaStatus(1000, null, "2026-09-01");

    expect(status.maturesOn).toBeNull();
    expect(status.matured).toBe(false);
    expect(status.monthsToMaturity).toBeNull();
  });

  it("computes the five-year date", () => {
    const status = buildPeaStatus(1000, "2023-03-15", "2026-09-01");
    expect(status.maturesOn).toBe("2028-03-15");
  });

  it("counts whole months to maturity", () => {
    const status = buildPeaStatus(1000, "2024-01-10", "2026-09-01");
    // Matures 2029-01-10; from 2026-09-01 that is 28 whole months.
    expect(status.monthsToMaturity).toBe(28);
  });

  it("does not count a month that has not reached its day", () => {
    const status = buildPeaStatus(1000, "2022-01-20", "2026-09-25");
    // Matures 2027-01-20. From 25 September, 20 January is 3 whole months.
    expect(status.monthsToMaturity).toBe(3);
  });

  it("reports a matured plan", () => {
    const status = buildPeaStatus(1000, "2019-01-01", "2026-09-01");

    expect(status.matured).toBe(true);
    expect(status.monthsToMaturity).toBeNull();
  });

  it("treats the maturity date itself as matured", () => {
    const status = buildPeaStatus(1000, "2021-09-01", "2026-09-01");
    expect(status.matured).toBe(true);
  });
});

describe("peaMaturityHint", () => {
  function hintFor(openedOn: string | null, today: string) {
    return peaMaturityHint(buildPeaStatus(0, openedOn, today));
  }

  it("says nothing without an opening date", () => {
    expect(hintFor(null, "2026-09-01")).toBeNull();
  });

  it("confirms a matured plan", () => {
    expect(hintFor("2019-01-01", "2026-09-01")).toContain("Past five years");
  });

  it("counts a single month", () => {
    expect(hintFor("2021-10-01", "2026-09-01")).toBe(
      "One month until the five-year mark.",
    );
  });

  it("counts months under a year", () => {
    expect(hintFor("2022-01-01", "2026-09-01")).toBe(
      "4 months until the five-year mark.",
    );
  });

  it("counts years and months", () => {
    expect(hintFor("2024-01-01", "2026-09-01")).toBe(
      "2 years 4 months until the five-year mark.",
    );
  });

  it("counts whole years without a stray month count", () => {
    expect(hintFor("2023-09-01", "2026-09-01")).toBe(
      "2 years until the five-year mark.",
    );
  });

  it("handles the month of maturity itself", () => {
    expect(hintFor("2021-09-15", "2026-09-01")).toBe(
      "Five years is reached this month.",
    );
  });
});
