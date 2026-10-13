import { describe, expect, it } from "vitest";

import {
  entraideTargetOf,
  excerptOf,
  handleProblem,
  hasLink,
  isEntraideFilter,
  isEntraideRule,
  isEntraideSort,
  threadHref,
  threadIdOf,
  threadSlug,
} from "./entraide";

describe("handleProblem", () => {
  it("takes letters, accents, digits and . _ - inside", () => {
    for (const handle of [
      "Léa",
      "jean_75",
      "marie.dupont",
      "Zoé-2026",
      "Cœur",
    ]) {
      expect(handleProblem(handle)).toBeNull();
    }
  });

  it("says why a pseudonym cannot be taken", () => {
    expect(handleProblem("ab")).toBe("short");
    expect(handleProblem("a".repeat(25))).toBe("long");
    expect(handleProblem("jean dupont")).toBe("characters");
    expect(handleProblem("_jean")).toBe("characters");
    expect(handleProblem("jean@mail")).toBe("characters");
    expect(handleProblem("Ελένη")).toBe("characters");
  });

  it("lets no one pass for Pluclair", () => {
    for (const handle of [
      "Pluclair",
      "pluclair_officiel",
      "Plu.clair",
      "PLUCLAIR-team",
    ]) {
      expect(handleProblem(handle)).toBe("reserved");
    }
  });
});

describe("hasLink", () => {
  it("finds web addresses, not words with dots", () => {
    expect(hasLink("voir https://exemple.fr")).toBe(true);
    expect(hasLink("sur www.exemple.fr")).toBe(true);
    expect(hasLink("le PEA, etc. et le PER")).toBe(false);
    expect(hasLink("service-public.gouv.fr")).toBe(false);
  });
});

describe("thread addresses", () => {
  it("makes a short plain slug from a French title", () => {
    expect(threadSlug("Comment choisir son jour de lecture ?")).toBe(
      "comment-choisir-son-jour-de-lecture",
    );
    expect(threadSlug("PEA ou assurance-vie : lequel d'abord ?")).toBe(
      "pea-ou-assurance-vie-lequel-d-abord",
    );
    expect(threadSlug("???")).toBe("question");
    expect(threadSlug("a ".repeat(50)).length).toBeLessThanOrEqual(60);
  });

  it("reads the id back, whatever follows it", () => {
    const href = threadHref(42, "Un titre");
    expect(href).toBe("/blog/entraide/42-un-titre");
    expect(threadIdOf("42-un-titre")).toBe(42);
    expect(threadIdOf("42-un-titre-change")).toBe(42);
    expect(threadIdOf("42")).toBe(42);
    expect(threadIdOf("regles")).toBeNull();
    expect(threadIdOf("0-x")).toBeNull();
    expect(threadIdOf("42-Titre")).toBeNull();
  });
});

describe("the list's doors", () => {
  it("takes only the filters and sorts it knows, from an address", () => {
    expect(isEntraideFilter("unanswered")).toBe(true);
    expect(isEntraideFilter("everything")).toBe(false);
    expect(isEntraideSort("useful")).toBe(true);
    expect(isEntraideSort(undefined)).toBe(false);
  });
});

describe("excerptOf", () => {
  it("reads the words, not the marks", () => {
    expect(
      excerptOf("**Ma carte** est à *débit différé*.\n\n- le 3\n- le 4"),
    ).toBe("Ma carte est à débit différé. le 3 · le 4");
    expect(excerptOf("Voir [la fiche](https://exemple.fr)")).toBe(
      "Voir la fiche",
    );
  });

  it("cuts at a word, with an ellipsis", () => {
    const text = "Une phrase assez longue pour être coupée, ".repeat(10);
    const excerpt = excerptOf(text, 60);
    expect(excerpt.length).toBeLessThanOrEqual(61);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).not.toMatch(/\s…$/);
  });
});

describe("what is reported", () => {
  it("names a post or an answer, and nothing else", () => {
    expect(entraideTargetOf("post:12")).toBe("post:12");
    expect(entraideTargetOf("reply:3")).toBe("reply:3");
    expect(entraideTargetOf("post:0")).toBeNull();
    expect(entraideTargetOf("changelog:x")).toBeNull();
  });

  it("knows the rules a report or a decision may name", () => {
    expect(isEntraideRule("promotion")).toBe(true);
    expect(isEntraideRule("none")).toBe(false);
  });
});
