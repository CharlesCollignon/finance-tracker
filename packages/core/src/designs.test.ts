import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESIGN,
  DESIGNS,
  isDesign,
  isLightDesign,
  parseDesign,
} from "./designs";

describe("designs", () => {
  it("defaults to nuit, the design Pluclair already had", () => {
    expect(DEFAULT_DESIGN).toBe("nuit");
    expect(DESIGNS[0]).toBe(DEFAULT_DESIGN);
  });

  it("reads anything unknown as the default", () => {
    expect(parseDesign(undefined)).toBe("nuit");
    expect(parseDesign(null)).toBe("nuit");
    expect(parseDesign("")).toBe("nuit");
    expect(parseDesign("dark")).toBe("nuit");
    expect(parseDesign(3)).toBe("nuit");
  });

  it("keeps every known design", () => {
    for (const design of DESIGNS) {
      expect(isDesign(design)).toBe(true);
      expect(parseDesign(design)).toBe(design);
    }
  });

  it("knows which designs are light", () => {
    expect(DESIGNS.filter(isLightDesign)).toEqual(["papier", "bento"]);
  });
});
