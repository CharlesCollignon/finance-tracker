import { describe, expect, it } from "vitest";

import { calculate } from "./calculator";

describe("calculate", () => {
  it("does the four operations with the usual precedence", () => {
    expect(calculate("1 + 2 * 3")).toBe(7);
    expect(calculate("(1 + 2) * 3")).toBe(9);
    expect(calculate("10 / 4 - 0.5")).toBe(2);
    expect(calculate("17 % 5")).toBe(2);
  });

  it("raises to a power, right to left", () => {
    expect(calculate("2^3^2")).toBe(512);
    expect(calculate("1000 * (1 + 0.03)^10")).toBeCloseTo(1343.916, 3);
  });

  it("takes a unary minus and decimals written with a point", () => {
    expect(calculate("-4 + 10")).toBe(6);
    expect(calculate("-(2 + 3)")).toBe(-5);
    expect(calculate(".5 * 4")).toBe(2);
    expect(calculate("1.5e3 / 3")).toBe(500);
  });

  it("knows a few functions", () => {
    expect(calculate("round(2 / 3, 2)")).toBe(0.67);
    expect(calculate("round(1234.5)")).toBe(1235);
    expect(calculate("max(3, 9, 4) - min(3, 9, 4)")).toBe(6);
    expect(calculate("abs(-12)")).toBe(12);
    expect(calculate("sqrt(16)")).toBe(4);
  });

  it("refuses anything that is not arithmetic", () => {
    expect(calculate("")).toBeNull();
    expect(calculate("process.exit()")).toBeNull();
    expect(calculate("1 +")).toBeNull();
    expect(calculate("(1 + 2")).toBeNull();
    expect(calculate("1 2")).toBeNull();
    expect(calculate("2 € + 3 €")).toBeNull();
    expect(calculate("foo(1)")).toBeNull();
    expect(calculate("1,5 + 1")).toBeNull();
  });

  it("refuses a division by zero and an infinite result", () => {
    expect(calculate("1 / 0")).toBeNull();
    expect(calculate("5 % 0")).toBeNull();
    expect(calculate("10^400")).toBeNull();
    expect(calculate("sqrt(-1)")).toBeNull();
  });

  it("refuses an expression too long or too deep", () => {
    expect(calculate(`${"1+".repeat(250)}1`)).toBeNull();
    expect(calculate(`${"(".repeat(40)}1${")".repeat(40)}`)).toBeNull();
  });
});
