import { describe, expect, it } from "vitest";

import { contributionStreak } from "./investment-streak";

const row = (occurred_on: string, amount = 100) => ({ occurred_on, amount });

describe("contributionStreak", () => {
  it("counts the months running, this one included once it has a contribution", () => {
    const rows = [row("2026-08-27"), row("2026-09-27"), row("2026-10-02")];
    expect(contributionStreak(rows, "2026-10-04")).toBe(3);
  });

  it("does not hold the month in progress against the run before it", () => {
    const rows = [row("2026-07-27"), row("2026-08-27"), row("2026-09-27")];
    expect(contributionStreak(rows, "2026-10-04")).toBe(3);
  });

  it("stops at the first month with nothing, across a year's turn", () => {
    const rows = [
      row("2025-10-27"),
      row("2025-12-27"),
      row("2026-01-27"),
      row("2026-02-27"),
    ];
    expect(contributionStreak(rows, "2026-03-01")).toBe(3);
  });

  it("is nothing without a contribution, and ignores a withdrawal", () => {
    expect(contributionStreak([], "2026-10-04")).toBe(0);
    expect(contributionStreak([row("2026-09-10", -50)], "2026-10-04")).toBe(0);
  });
});
