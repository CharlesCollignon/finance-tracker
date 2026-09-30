import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  isLocale,
  parseLocale,
  preferredLocale,
} from "./locale";

describe("the defaults", () => {
  it("speaks French to anyone who has not chosen, and falls back on English", () => {
    expect(DEFAULT_LOCALE).toBe("fr");
    expect(FALLBACK_LOCALE).toBe("en");
  });
});

describe("isLocale", () => {
  it("accepts the two supported languages", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(true);
  });

  it("rejects anything else, including a regioned tag", () => {
    expect(isLocale("fr-FR")).toBe(false);
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(2)).toBe(false);
  });
});

describe("parseLocale", () => {
  it("reads a bare language", () => {
    expect(parseLocale("fr")).toBe("fr");
  });

  it("reads a language out of a regioned tag, whatever its case", () => {
    expect(parseLocale("fr-CA")).toBe("fr");
    expect(parseLocale("EN-gb")).toBe("en");
  });

  it("tolerates the whitespace a cookie or a form field arrives with", () => {
    expect(parseLocale("  fr  ")).toBe("fr");
  });

  it("names no locale for a value that names none", () => {
    expect(parseLocale("de-DE")).toBeNull();
    expect(parseLocale("")).toBeNull();
    expect(parseLocale(null)).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
  });
});

describe("preferredLocale", () => {
  it("prefers nothing when the browser says nothing", () => {
    expect(preferredLocale(undefined)).toBeNull();
    expect(preferredLocale(null)).toBeNull();
    expect(preferredLocale("   ")).toBeNull();
  });

  it("reads a single supported language", () => {
    expect(preferredLocale("fr")).toBe("fr");
    expect(preferredLocale("en-US")).toBe("en");
  });

  it("follows the quality weights over the order", () => {
    expect(preferredLocale("en;q=0.4,fr;q=0.9")).toBe("fr");
    expect(preferredLocale("fr;q=0.4,en;q=0.9")).toBe("en");
  });

  it("keeps the order sent when the weights are equal", () => {
    expect(preferredLocale("fr,en")).toBe("fr");
    expect(preferredLocale("en,fr")).toBe("en");
  });

  it("skips languages it has no catalogue for", () => {
    expect(preferredLocale("de-DE,de;q=0.9,fr;q=0.8")).toBe("fr");
    expect(preferredLocale("de-DE,de;q=0.9")).toBeNull();
  });

  it("treats q=0 as refused and a malformed weight as unreadable", () => {
    expect(preferredLocale("fr;q=0,en;q=0.1")).toBe("en");
    expect(preferredLocale("fr;q=banana,en")).toBe("en");
  });

  it("reads a wildcard as asking for nothing in particular", () => {
    expect(preferredLocale("*")).toBeNull();
    expect(preferredLocale("de,*;q=0.5")).toBeNull();
    expect(preferredLocale("en;q=0.9,*;q=0.1")).toBe("en");
  });
});
