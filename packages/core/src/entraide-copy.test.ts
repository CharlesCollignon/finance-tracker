import { describe, expect, it } from "vitest";

import {
  countWords,
  entraideCopyFor,
  entraideErrorText,
  entraideWhen,
} from "./entraide-copy";

describe("entraideWhen", () => {
  const now = new Date("2026-10-13T12:00:00Z");

  it("says how long ago, in minutes, then hours, then yesterday", () => {
    expect(entraideWhen("2026-10-13T11:59:40Z", now, "fr")).toBe("à l'instant");
    expect(entraideWhen("2026-10-13T11:48:00Z", now, "en")).toBe("12 min ago");
    expect(entraideWhen("2026-10-13T09:00:00Z", now, "en")).toBe("3 h ago");
    expect(entraideWhen("2026-10-12T09:00:00Z", now, "en")).toBe("yesterday");
  });

  it("names the day in Paris, with the year only when it is another", () => {
    // 23:30 UTC on the 30 September is the 1 October in Paris.
    expect(entraideWhen("2026-09-30T23:30:00Z", now, "fr")).toBe("1er octobre");
    expect(entraideWhen("2025-12-02T10:00:00Z", now, "en")).toBe(
      "2 December 2025",
    );
  });
});

describe("countWords", () => {
  it("says one, or the count", () => {
    const words = entraideCopyFor("fr").list.replies;
    expect(countWords(words, 1)).toBe(words.one);
    expect(countWords(words, 3)).toBe(words.many.replace("{count}", "3"));
  });
});

describe("entraideErrorText", () => {
  it("says a refusal by name, and anything else as the generic one", () => {
    const copy = entraideCopyFor("en");
    expect(entraideErrorText(copy, "entraide.handleTaken")).toBe(
      copy.errors["entraide.handleTaken"],
    );
    expect(entraideErrorText(copy, "errors.tooManyAttempts")).toBe(
      copy.errors.tooManyAttempts,
    );
    expect(entraideErrorText(copy, "bankConnect.unreachable")).toBe(
      copy.errors.generic,
    );
  });
});
