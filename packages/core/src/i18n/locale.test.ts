import { describe, expect, it } from "vitest";
import {
  isLocale,
  localeForCountry,
  negotiateLocale,
  parseLocale,
} from "./locale";

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

describe("negotiateLocale", () => {
  it("falls back to English when the header is absent or empty", () => {
    expect(negotiateLocale(undefined)).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("   ")).toBe("en");
  });

  it("takes the only language on offer", () => {
    expect(negotiateLocale("fr")).toBe("fr");
  });

  it("prefers the higher quality rather than the earlier entry", () => {
    expect(negotiateLocale("en;q=0.4,fr;q=0.9")).toBe("fr");
    expect(negotiateLocale("fr;q=0.4,en;q=0.9")).toBe("en");
  });

  it("keeps the sent order when qualities tie", () => {
    expect(negotiateLocale("fr,en")).toBe("fr");
    expect(negotiateLocale("en,fr")).toBe("en");
  });

  it("treats a missing quality as the strongest preference", () => {
    // The real header Chrome sends with French first.
    expect(negotiateLocale("fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("fr");
  });

  it("skips languages it does not have", () => {
    expect(negotiateLocale("de-DE,de;q=0.9,fr;q=0.8")).toBe("fr");
  });

  it("honours q=0 as a refusal rather than a weak preference", () => {
    expect(negotiateLocale("fr;q=0,en;q=0.1")).toBe("en");
  });

  it("ignores an entry whose quality cannot be read", () => {
    expect(negotiateLocale("fr;q=banana,en")).toBe("en");
  });

  it("answers a wildcard with the default", () => {
    expect(negotiateLocale("*")).toBe("en");
    expect(negotiateLocale("de,*;q=0.5")).toBe("en");
  });

  it("does not let an unsupported language outrank the wildcard's default", () => {
    expect(negotiateLocale("fr;q=0.9,*;q=0.1")).toBe("fr");
  });
});

describe("localeForCountry", () => {
  it("suggests French for a country where French is official", () => {
    expect(localeForCountry("FR")).toBe("fr");
    expect(localeForCountry("BE")).toBe("fr");
    expect(localeForCountry("SN")).toBe("fr");
  });

  it("does not care about case or padding", () => {
    expect(localeForCountry(" fr ")).toBe("fr");
  });

  it("suggests nothing for a country it has no opinion about", () => {
    // Not "en": a country that does not suggest French suggests nothing, so
    // an English reader in Germany is never asked to confirm English.
    expect(localeForCountry("DE")).toBeNull();
    expect(localeForCountry("GB")).toBeNull();
    expect(localeForCountry("US")).toBeNull();
  });

  it("suggests nothing for the Maghreb, where French is read but not official", () => {
    expect(localeForCountry("MA")).toBeNull();
    expect(localeForCountry("TN")).toBeNull();
    expect(localeForCountry("DZ")).toBeNull();
  });

  it("suggests nothing for a value that is not a country code", () => {
    expect(localeForCountry("FRA")).toBeNull();
    expect(localeForCountry("")).toBeNull();
    expect(localeForCountry(null)).toBeNull();
    expect(localeForCountry(undefined)).toBeNull();
  });
});
