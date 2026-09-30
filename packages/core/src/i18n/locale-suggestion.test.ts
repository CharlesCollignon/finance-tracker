import { describe, expect, it } from "vitest";
import { suggestLocale } from "./locale-suggestion";

describe("suggestLocale", () => {
  it("offers English to a reader in French whose device prefers English", () => {
    expect(suggestLocale({ current: "fr", preferred: "en", asked: false })).toBe(
      "en",
    );
  });

  it("asks only once", () => {
    expect(
      suggestLocale({ current: "fr", preferred: "en", asked: true }),
    ).toBeNull();
  });

  it("says nothing when the device already has what is on screen", () => {
    expect(
      suggestLocale({ current: "fr", preferred: "fr", asked: false }),
    ).toBeNull();
    expect(
      suggestLocale({ current: "en", preferred: "en", asked: false }),
    ).toBeNull();
  });

  it("says nothing when the device prefers no language we have", () => {
    expect(
      suggestLocale({ current: "fr", preferred: null, asked: false }),
    ).toBeNull();
    expect(
      suggestLocale({ current: "fr", preferred: undefined, asked: false }),
    ).toBeNull();
  });
});
