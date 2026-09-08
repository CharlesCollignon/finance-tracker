import { describe, expect, it } from "vitest";
import { pluralCategory, resolveMessage, translator } from "./t";

describe("pluralCategory", () => {
  it("puts only one in the English singular", () => {
    expect(pluralCategory("en", 0)).toBe("other");
    expect(pluralCategory("en", 1)).toBe("one");
    expect(pluralCategory("en", 2)).toBe("other");
  });

  it("puts zero in the French singular", () => {
    // The case that makes a `count === 1` ternary untranslatable: French
    // writes "0 récurrent", English writes "0 recurring items".
    expect(pluralCategory("fr", 0)).toBe("one");
    expect(pluralCategory("fr", 1)).toBe("one");
    expect(pluralCategory("fr", 2)).toBe("other");
  });

  it("reads a negative count by its magnitude", () => {
    expect(pluralCategory("en", -1)).toBe("one");
    expect(pluralCategory("fr", -1)).toBe("one");
    expect(pluralCategory("en", -2)).toBe("other");
  });

  it("gives French its third form for whole millions", () => {
    expect(pluralCategory("fr", 1_000_000)).toBe("many");
    expect(pluralCategory("fr", 2_000_000)).toBe("many");
    expect(pluralCategory("fr", 1_000_001)).toBe("other");
    expect(pluralCategory("en", 1_000_000)).toBe("other");
  });
});

describe("translator", () => {
  it("returns a plain message", () => {
    expect(translator("en")("calendar.today")).toBe("Today");
    expect(translator("fr")("calendar.today")).toBe("Aujourd'hui");
  });

  it("fills in variables", () => {
    expect(
      translator("en")("push.breach.body", { spent: "€420", limit: "€400" }),
    ).toBe("€420 spent of €400.");
  });

  it("leaves an unfilled placeholder visible rather than blanking it", () => {
    // A gap that names the missing variable is a bug report; a gap that
    // silently closes up is a sentence with a word missing.
    expect(translator("en")("push.breach.body", { spent: "€420" })).toBe(
      "€420 spent of {limit}.",
    );
  });

  it("selects the plural form from the count", () => {
    const t = translator("en");
    expect(t("push.monthOpen.pending", { count: 1 })).toBe(
      "1 recurring item is ready to apply.",
    );
    expect(t("push.monthOpen.pending", { count: 3 })).toBe(
      "3 recurring items are ready to apply.",
    );
  });

  it("selects the French plural, zero included", () => {
    const t = translator("fr");
    expect(t("push.monthOpen.pending", { count: 0 })).toBe(
      "0 récurrent est prêt à être appliqué.",
    );
    expect(t("push.monthOpen.pending", { count: 1 })).toBe(
      "1 récurrent est prêt à être appliqué.",
    );
    expect(t("push.monthOpen.pending", { count: 2 })).toBe(
      "2 récurrents sont prêts à être appliqués.",
    );
  });

  it("reads as the plural when a plural message is asked for without a count", () => {
    expect(translator("en")("push.arrived.title")).toBe("Did these arrive?");
  });

  it("returns the key itself for a message that does not exist", () => {
    // Visible and unmistakable, which is what a missing string should be. The
    // cast is the point of the test: at a real call site this would not typecheck.
    const t = translator("en") as (key: string) => string;
    expect(t("nothing.here")).toBe("nothing.here");
    expect(t("calendar")).toBe("calendar");
    expect(t("calendar.today.deeper")).toBe("calendar.today.deeper");
  });
});

describe("resolveMessage", () => {
  const t = translator("fr");

  it("translates a message key", () => {
    expect(resolveMessage(t, "errors.amountPositive")).toBe(
      "Le montant doit être positif",
    );
  });

  it("hands back a sentence it has no message for", () => {
    // The property the validation design rests on. A Zod schema emits a key
    // because it is built before any request has a language; every other
    // error on the same field is a sentence from somewhere else — Postgres, a
    // network stack — and has to arrive intact.
    const fromPostgres = 'duplicate key value violates unique constraint "x"';
    expect(resolveMessage(t, fromPostgres)).toBe(fromPostgres);
  });

  it("is idempotent, so a caller that already translated is unharmed", () => {
    const once = resolveMessage(t, "errors.pickCategory");
    expect(resolveMessage(t, once)).toBe(once);
  });

  it("does not mistake a dotted sentence for a key", () => {
    const sentence = "Something went wrong. Try again.";
    expect(resolveMessage(t, sentence)).toBe(sentence);
  });
});
