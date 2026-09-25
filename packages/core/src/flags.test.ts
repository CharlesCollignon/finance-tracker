import { describe, expect, it } from "vitest";
import {
  flagsFromRows,
  isFlagOn,
  NO_FLAGS,
  parseStoredFlags,
  serializeFlags,
} from "./flags";

describe("flagsFromRows", () => {
  it("turns a flag on when the database says it is", () => {
    const flags = flagsFromRows([{ key: "tags.manage", enabled: true }]);
    expect(isFlagOn(flags, "tags.manage")).toBe(true);
  });

  it("keeps a flag off when the database says it is off", () => {
    const flags = flagsFromRows([{ key: "tags.manage", enabled: false }]);
    expect(isFlagOn(flags, "tags.manage")).toBe(false);
  });

  it("ignores a flag this build does not know", () => {
    const flags = flagsFromRows([
      { key: "no.such_flag", enabled: true },
      { key: "tags.manage", enabled: true },
    ]);
    expect([...flags]).toEqual(["tags.manage"]);
  });

  it("reads anything that is not a list of rows as no flags", () => {
    expect(flagsFromRows(null).size).toBe(0);
    expect(flagsFromRows({ key: "tags.manage", enabled: true }).size).toBe(0);
    expect(
      flagsFromRows([null, "tags.manage", { key: "tags.manage" }]).size,
    ).toBe(0);
  });

  it("only counts `enabled: true`, not something truthy", () => {
    expect(flagsFromRows([{ key: "tags.manage", enabled: "true" }]).size).toBe(
      0,
    );
  });
});

describe("isFlagOn", () => {
  it("is off for every key when nothing is known", () => {
    expect(isFlagOn(NO_FLAGS, "tags.manage")).toBe(false);
  });
});

describe("the phone's cache format", () => {
  it("round-trips the flags that are on", () => {
    const flags = flagsFromRows([{ key: "tags.manage", enabled: true }]);
    const back = parseStoredFlags(serializeFlags(flags));
    expect(back && isFlagOn(back, "tags.manage")).toBe(true);
  });

  it("says nothing is cached when nothing is", () => {
    expect(parseStoredFlags(null)).toBeNull();
  });

  it("treats a damaged entry as nothing cached, not as no flags", () => {
    expect(parseStoredFlags("{not json")).toBeNull();
    expect(parseStoredFlags('{"tags.manage":true}')).toBeNull();
  });

  it("drops a key an older or newer build wrote", () => {
    const back = parseStoredFlags('["no.such_flag","tags.manage"]');
    expect(back ? [...back] : null).toEqual(["tags.manage"]);
  });
});
