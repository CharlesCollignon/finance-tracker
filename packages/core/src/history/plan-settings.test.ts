import { describe, expect, it } from "vitest";
import type { Envelope } from "../future-plan";
import {
  parseHypothesesEdits,
  parseTrajectorySettings,
  TRAJECTORY_DEFAULT_SETTINGS,
  typedReturns,
  withEdits,
} from "./plan-settings";

describe("parseTrajectorySettings", () => {
  it("falls back to the defaults on anything unreadable", () => {
    expect(parseTrajectorySettings(null)).toEqual(TRAJECTORY_DEFAULT_SETTINGS);
    expect(parseTrajectorySettings("10")).toEqual(TRAJECTORY_DEFAULT_SETTINGS);
  });

  it("keeps a horizon it offers, and only that", () => {
    expect(
      parseTrajectorySettings({ years: 30, to: "pea", withProperty: true }),
    ).toEqual({ years: 30, to: "pea", withProperty: true });
    expect(parseTrajectorySettings({ years: 40 }).years).toBe(10);
  });
});

describe("parseHypothesesEdits", () => {
  it("keeps each figure inside its field's bounds", () => {
    expect(
      parseHypothesesEdits({
        pea: { initial: -5, fees: 0.2, taxOnGains: 2, annualReturn: 0.5 },
        av: { monthly: 150 },
      }),
    ).toEqual({
      pea: { initial: 0, fees: 0.05, taxOnGains: 1, annualReturn: 0.3 },
      av: { monthly: 150 },
    });
  });

  it("drops accounts it does not know and figures that are not numbers", () => {
    expect(
      parseHypothesesEdits({ nowhere: { initial: 5 }, pea: { initial: "5" } }),
    ).toEqual({});
    expect(parseHypothesesEdits(undefined)).toEqual({});
  });
});

describe("withEdits and typedReturns", () => {
  const pea: Envelope = {
    id: "pea",
    initial: 1000,
    monthly: 100,
    annualReturn: 0.07,
    taxOnGains: 0.172,
  };

  it("lays the figures over and leaves the return to shift history", () => {
    const edits = { pea: { monthly: 300, annualReturn: 0.05, fees: 0.004 } };
    expect(withEdits([pea], edits)).toEqual([
      { ...pea, monthly: 300, fees: 0.004 },
    ]);
    expect(typedReturns(edits)).toEqual({ pea: 0.05 });
  });
});
