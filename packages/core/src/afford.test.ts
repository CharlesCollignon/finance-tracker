import { describe, expect, it } from "vitest";

import { affordAnswer } from "./afford";

describe("affordAnswer", () => {
  const lowest = { date: "2026-10-15", value: 300 };

  it("takes a one-off from the figure and from the lowest point ahead", () => {
    expect(
      affordAnswer({
        left: { amount: 412 },
        lowest,
        eachMonth: 650,
        amount: 89.9,
        cadence: "once",
      }),
    ).toEqual({
      leftAfter: 322.1,
      lowestAfter: { date: "2026-10-15", value: 210.1 },
      eachMonthAfter: null,
    });
  });

  it("says what each month would leave for a monthly one", () => {
    expect(
      affordAnswer({
        left: { amount: 412 },
        lowest,
        eachMonth: 650,
        amount: 30,
        cadence: "monthly",
      }).eachMonthAfter,
    ).toBe(620);
  });

  it("goes below zero rather than refusing", () => {
    const answer = affordAnswer({
      left: { amount: 100 },
      lowest: null,
      eachMonth: null,
      amount: 140,
      cadence: "monthly",
    });
    expect(answer).toEqual({
      leftAfter: -40,
      lowestAfter: null,
      eachMonthAfter: null,
    });
  });
});
