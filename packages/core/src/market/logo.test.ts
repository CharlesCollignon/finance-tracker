import { describe, expect, it } from "vitest";
import { instrumentLogoUrl } from "./logo";

describe("instrumentLogoUrl", () => {
  it("asks for the CDN's own SVG by default, for a browser", () => {
    expect(instrumentLogoUrl(" MC.PA ")).toBe(
      "https://assets.parqet.com/logos/symbol/MC.PA",
    );
  });

  it("asks for a PNG at a size, for the phone's Image", () => {
    expect(instrumentLogoUrl("CW8.PA", { size: 128 })).toBe(
      "https://assets.parqet.com/logos/symbol/CW8.PA?format=png&size=128",
    );
  });
});
