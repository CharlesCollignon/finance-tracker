import { describe, expect, it } from "vitest";
import { suggestLocale } from "./locale-suggestion";

describe("suggestLocale", () => {
  it("offers French to an English reader in France", () => {
    expect(suggestLocale({ current: "en", country: "FR", asked: false })).toBe(
      "fr",
    );
  });

  it("says nothing once the reader has answered", () => {
    expect(
      suggestLocale({ current: "en", country: "FR", asked: true }),
    ).toBeNull();
  });

  it("says nothing when the country agrees with the screen", () => {
    expect(
      suggestLocale({ current: "fr", country: "FR", asked: false }),
    ).toBeNull();
  });

  it("says nothing when the country suggests nothing", () => {
    expect(
      suggestLocale({ current: "en", country: "DE", asked: false }),
    ).toBeNull();
    expect(
      suggestLocale({ current: "fr", country: "DE", asked: false }),
    ).toBeNull();
  });

  it("says nothing without a country to go on", () => {
    // Which is every request off the platform, so this is the local
    // development case as much as it is the missing-header one.
    expect(
      suggestLocale({ current: "en", country: null, asked: false }),
    ).toBeNull();
    expect(
      suggestLocale({ current: "en", country: undefined, asked: false }),
    ).toBeNull();
  });
});
