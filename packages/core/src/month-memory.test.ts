import { describe, expect, it } from "vitest";

import { formatRememberedMonth, parseRememberedMonth } from "./month-memory";

describe("formatRememberedMonth", () => {
  it("zero-pads the month so values sort as text", () => {
    expect(formatRememberedMonth(2026, 3)).toBe("2026-03");
    expect(formatRememberedMonth(2026, 12)).toBe("2026-12");
  });

  it("round-trips through the parser", () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(parseRememberedMonth(formatRememberedMonth(2026, month))).toEqual({
        year: 2026,
        month,
      });
    }
  });
});

describe("parseRememberedMonth", () => {
  it("reads a well-formed month", () => {
    expect(parseRememberedMonth("2026-03")).toEqual({ year: 2026, month: 3 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseRememberedMonth("  2026-03  ")).toEqual({
      year: 2026,
      month: 3,
    });
  });

  it("refuses a month outside 1-12", () => {
    // The reason this matters: `new Date(2026, 13 - 1, 1)` is January 2027 and
    // `new Date(2026, -1, 1)` is December 2025, so an unchecked value would
    // show a different year from every label on the screen.
    expect(parseRememberedMonth("2026-13")).toBeNull();
    expect(parseRememberedMonth("2026-00")).toBeNull();
  });

  it("refuses a year outside the plausible range", () => {
    expect(parseRememberedMonth("0001-05")).toBeNull();
    expect(parseRememberedMonth("9999-05")).toBeNull();
  });

  it("refuses a loose spelling of a real month", () => {
    // One month, one spelling. Accepting both would mean two cookie values
    // that mean the same thing and compare as different.
    expect(parseRememberedMonth("2026-3")).toBeNull();
    expect(parseRememberedMonth("26-03")).toBeNull();
    expect(parseRememberedMonth("2026/03")).toBeNull();
    expect(parseRememberedMonth("2026-03-01")).toBeNull();
  });

  it("refuses anything that is not a string", () => {
    expect(parseRememberedMonth(null)).toBeNull();
    expect(parseRememberedMonth(undefined)).toBeNull();
    expect(parseRememberedMonth("")).toBeNull();
  });

  it("refuses an injection attempt rather than reading a month out of it", () => {
    expect(parseRememberedMonth("2026-03; Path=/admin")).toBeNull();
    expect(parseRememberedMonth("<script>2026-03</script>")).toBeNull();
  });
});
