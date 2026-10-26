import { describe, expect, it } from "vitest";
import { buildSpaceBalance, spaceBalanceIsEmpty } from "./space-balance";

const alice = { userId: "a", name: "Alice", share: 0.6, put: 600 };
const bob = { userId: "b", name: "Bob", share: 0.4, put: 400 };

describe("buildSpaceBalance", () => {
  it("counts each partner's part of what was spent, and their difference", () => {
    const balance = buildSpaceBalance([alice, bob], 900);
    expect(balance.spent).toBe(900);
    expect(balance.members[0]).toMatchObject({ part: 540, diff: 60 });
    expect(balance.members[1]).toMatchObject({ part: 360, diff: 40 });
  });

  it("names the partner behind the split, and what levels it", () => {
    // Alice is 60 ahead, Bob 40 ahead: Bob would put in 20 more to match.
    const balance = buildSpaceBalance([alice, bob], 900);
    expect(balance.settle).toEqual({ userId: "b", name: "Bob", amount: 20 });
    const other = buildSpaceBalance([alice, { ...bob, put: 500 }], 900);
    expect(other.settle).toEqual({ userId: "a", name: "Alice", amount: 80 });
  });

  it("says nothing when the two are level, or when one is alone", () => {
    // Alice 60 ahead; Bob at 420 is 60 ahead too.
    expect(buildSpaceBalance([alice, { ...bob, put: 420 }], 900).settle).toBeNull();
    expect(buildSpaceBalance([alice], 900).settle).toBeNull();
    // A cent is a rounding, not a debt.
    expect(
      buildSpaceBalance([alice, { ...bob, put: 420.004 }], 900).settle,
    ).toBeNull();
  });

  it("knows when there is nothing to say", () => {
    expect(
      spaceBalanceIsEmpty(
        buildSpaceBalance([{ ...alice, put: 0 }, { ...bob, put: 0 }], 0),
      ),
    ).toBe(true);
    expect(spaceBalanceIsEmpty(buildSpaceBalance([alice, bob], 0))).toBe(false);
  });
});
