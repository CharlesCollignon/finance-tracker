import { describe, expect, it } from "vitest";
import { flagsFromRows, isFlagOn, NO_FLAGS } from "./flags";

describe("flagsFromRows", () => {
  it("turns a flag on when the database says it is", () => {
    const flags = flagsFromRows([{ key: "bank.connect", enabled: true }]);
    expect(isFlagOn(flags, "bank.connect")).toBe(true);
  });

  it("keeps a flag off when the database says it is off", () => {
    const flags = flagsFromRows([{ key: "bank.connect", enabled: false }]);
    expect(isFlagOn(flags, "bank.connect")).toBe(false);
  });

  it("ignores a flag this build does not know", () => {
    const flags = flagsFromRows([
      { key: "no.such_flag", enabled: true },
      { key: "bank.connect", enabled: true },
    ]);
    expect([...flags]).toEqual(["bank.connect"]);
  });

  it("reads anything that is not a list of rows as no flags", () => {
    expect(flagsFromRows(null).size).toBe(0);
    expect(flagsFromRows({ key: "bank.connect", enabled: true }).size).toBe(0);
    expect(
      flagsFromRows([null, "bank.connect", { key: "bank.connect" }]).size,
    ).toBe(0);
  });

  it("only counts `enabled: true`, not something truthy", () => {
    expect(flagsFromRows([{ key: "bank.connect", enabled: "true" }]).size).toBe(
      0,
    );
  });
});

describe("isFlagOn", () => {
  it("is off for every key when nothing is known", () => {
    expect(isFlagOn(NO_FLAGS, "bank.connect")).toBe(false);
  });
});
