import { describe, expect, it } from "vitest";
import { CHANGELOG } from "@finance/core/changelog-entries";
import { isLandingPageId } from "@/components/marketing/landing-copy";
import { dayAndMonth, riverEntry } from "./river-entry";

describe("the changelog against the site", () => {
  it("names only feature pages the site has", () => {
    for (const entry of CHANGELOG) {
      if (entry.feature) {
        expect(isLandingPageId(entry.feature), entry.id).toBe(true);
      }
    }
  });
});

describe("riverEntry", () => {
  it("puts an entry in the reader's language, with its page's own name", () => {
    const entry = CHANGELOG.find(
      (candidate) => candidate.id === "2026-10-02-property",
    )!;
    const fr = riverEntry(entry, "fr");
    expect(fr.title).toBe(entry.fr.title);
    expect(fr.feature).toEqual({ id: "property", title: "Immobilier" });
    expect(fr.featured).toBe(true);
    expect(riverEntry(entry, "en").title).toBe(entry.en.title);
  });
});

describe("dayAndMonth", () => {
  it("says the first of the month the French way", () => {
    expect(dayAndMonth("2026-10-01", "fr")).toBe("1er octobre");
    expect(dayAndMonth("2026-10-05", "fr")).toBe("5 octobre");
    expect(dayAndMonth("2026-10-01", "en")).toBe("1 October");
  });
});
