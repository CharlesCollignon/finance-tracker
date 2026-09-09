import { describe, expect, it } from "vitest";

import {
  buildBearing,
  type BearingInput,
  type WeighedPosition,
} from "./bearing";

function position(
  name: string,
  marketValue: number,
): WeighedPosition {
  return { name, marketValue };
}

function input(partial: Partial<BearingInput> = {}): BearingInput {
  return {
    onHand: 4000,
    positions: [],
    ...partial,
  };
}

describe("buildBearing", () => {
  describe("the net position", () => {
    it("adds what is invested to what is in the account", () => {
      const bearing = buildBearing(
        input({ onHand: 4000, positions: [position("World ETF", 12000)] }),
      );

      expect(bearing.netPosition).toBe(16000);
      expect(bearing.invested).toBe(12000);
    });

    it("is the balance alone when nothing is invested", () => {
      const bearing = buildBearing(input({ onHand: 4000, positions: [] }));

      expect(bearing.netPosition).toBe(4000);
      expect(bearing.invested).toBe(0);
    });

    it("is null without a readable balance, not the invested half", () => {
      // The whole point of the figure is that it is the whole of it. Reporting
      // the portfolio and calling it a net position would understate someone's
      // position by however much is in their current account.
      const bearing = buildBearing(
        input({ onHand: null, positions: [position("World ETF", 12000)] }),
      );

      expect(bearing.netPosition).toBeNull();
      expect(bearing.invested).toBe(12000);
    });

    it("rounds to the cent", () => {
      const bearing = buildBearing(
        input({ onHand: 0.1, positions: [position("Fund", 0.2)] }),
      );

      expect(bearing.netPosition).toBe(0.3);
    });
  });

  describe("the invested share", () => {
    it("is what is invested over the whole position", () => {
      const bearing = buildBearing(
        input({ onHand: 5000, positions: [position("World ETF", 15000)] }),
      );

      expect(bearing.investedShare).toBe(0.75);
    });

    it("is null without a readable balance", () => {
      const bearing = buildBearing(
        input({ onHand: null, positions: [position("World ETF", 15000)] }),
      );

      expect(bearing.investedShare).toBeNull();
    });

    it("is null rather than enormous when the account is overdrawn", () => {
      // A ratio against a net position of nearly nothing is arithmetically
      // fine and completely useless on a screen: "980% invested" is not a
      // sentence anyone can act on.
      const bearing = buildBearing(
        input({ onHand: -12000, positions: [position("World ETF", 12000)] }),
      );

      expect(bearing.investedShare).toBeNull();
    });

    it("is zero when nothing is invested", () => {
      const bearing = buildBearing(input({ onHand: 4000, positions: [] }));

      expect(bearing.investedShare).toBe(0);
    });
  });

  describe("concentration", () => {
    it("names the heaviest holding and its share of the portfolio", () => {
      const bearing = buildBearing(
        input({
          positions: [
            position("World ETF", 6000),
            position("Bitcoin", 3000),
            position("Small caps", 1000),
          ],
        }),
      );

      expect(bearing.concentration).toEqual({
        name: "World ETF",
        value: 6000,
        weight: 0.6,
      });
    });

    it("weighs against the portfolio, not the net position", () => {
      // Cash is not diversification. A single-fund portfolio beside a large
      // current account is still a single-fund portfolio, and weighing the
      // holding against cash too would report it as comfortably spread.
      const bearing = buildBearing(
        input({ onHand: 90000, positions: [position("World ETF", 10000)] }),
      );

      expect(bearing.concentration?.weight).toBe(1);
    });

    it("is null when nothing is held", () => {
      const bearing = buildBearing(input({ positions: [] }));

      expect(bearing.concentration).toBeNull();
    });

    it("ignores positions worth nothing", () => {
      const bearing = buildBearing(
        input({
          positions: [position("Closed out", 0), position("World ETF", 500)],
        }),
      );

      expect(bearing.concentration?.name).toBe("World ETF");
    });

    it("is null when every position is worth nothing", () => {
      const bearing = buildBearing(
        input({ positions: [position("Closed out", 0)] }),
      );

      expect(bearing.concentration).toBeNull();
    });
  });
});
