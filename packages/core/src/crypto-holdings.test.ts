import { describe, expect, it } from "vitest";

import { BITCOIN_INSTRUMENT, isBitcoinSymbol } from "./crypto-holdings";

describe("isBitcoinSymbol", () => {
  it("knows Bitcoin in any currency, and the app's own instrument", () => {
    expect(isBitcoinSymbol(BITCOIN_INSTRUMENT.symbol)).toBe(true);
    expect(isBitcoinSymbol("BTC-USD")).toBe(true);
    expect(isBitcoinSymbol(" btc ")).toBe(true);
  });

  it("leaves every other symbol to the logo CDN", () => {
    expect(isBitcoinSymbol(null)).toBe(false);
    expect(isBitcoinSymbol("ETH-EUR")).toBe(false);
    expect(isBitcoinSymbol("BTCE.PA")).toBe(false);
  });
});
