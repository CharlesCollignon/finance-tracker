import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCOUNT_ORDER,
  moveAccount,
  orderAccounts,
  parseAccountOrder,
  slotAfterDrag,
} from "./account-order";

describe("DEFAULT_ACCOUNT_ORDER", () => {
  it("puts the CTO, the PEA and crypto first, then the rest as they were", () => {
    expect(DEFAULT_ACCOUNT_ORDER).toEqual([
      "cto",
      "pea",
      "crypto",
      "livret_a",
      "ldds",
      "lep",
      "cel",
      "pel",
      "livret",
      "av",
      "per",
    ]);
  });
});

describe("orderAccounts", () => {
  it("follows the default order when nothing is saved", () => {
    expect(
      orderAccounts(["livret_a", "pea", "av", "crypto", "cto"], null),
    ).toEqual(["cto", "pea", "crypto", "livret_a", "av"]);
  });

  it("follows a saved order, and puts what it does not name after it", () => {
    expect(
      orderAccounts(["livret_a", "pea", "av", "crypto", "cto"], ["av", "pea"]),
    ).toEqual(["av", "pea", "cto", "crypto", "livret_a"]);
  });

  it("skips saved accounts no longer kept", () => {
    expect(orderAccounts(["pea", "cto"], ["ldds", "pea", "per"])).toEqual([
      "pea",
      "cto",
    ]);
  });
});

describe("parseAccountOrder", () => {
  it("keeps known ids, once each", () => {
    expect(parseAccountOrder(["pea", "nope", "pea", 3, "ldds"])).toEqual([
      "pea",
      "ldds",
    ]);
  });

  it("reads anything but a list as nothing saved", () => {
    expect(parseAccountOrder(null)).toBeNull();
    expect(parseAccountOrder("pea")).toBeNull();
  });
});

describe("moveAccount", () => {
  it("moves one account and keeps the others in order", () => {
    expect(moveAccount(["a", "b", "c", "d"], 0, 2)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(moveAccount(["a", "b", "c", "d"], 3, 0)).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
  });

  it("leaves the order alone for a move to the same place or from nowhere", () => {
    expect(moveAccount(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveAccount(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("slotAfterDrag", () => {
  const widths = [60, 60, 60, 60];
  const gap = 6;

  it("stays put until the middle of a neighbour is passed", () => {
    expect(slotAfterDrag(widths, gap, 1, 0)).toBe(1);
    expect(slotAfterDrag(widths, gap, 1, 35)).toBe(1);
    expect(slotAfterDrag(widths, gap, 1, 36)).toBe(2);
    expect(slotAfterDrag(widths, gap, 1, -36)).toBe(0);
  });

  it("passes several neighbours on a long drag, and stops at the ends", () => {
    expect(slotAfterDrag(widths, gap, 0, 102)).toBe(2);
    expect(slotAfterDrag(widths, gap, 0, 1000)).toBe(3);
    expect(slotAfterDrag(widths, gap, 3, -1000)).toBe(0);
  });
});
