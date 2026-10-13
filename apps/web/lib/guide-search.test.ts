import { describe, expect, it } from "vitest";
import type { GuideMeta } from "./guide-list";
import { matchGuides } from "./guide-search";

const meta = (title: string, description: string): GuideMeta => ({
  title,
  description,
  rubrique: "mois",
  published: "2026-10-13",
  updated: "2026-10-13",
  minutes: 3,
});

const guides = [
  {
    slug: "jour-de-lecture" as const,
    meta: meta(
      "Le jour de lecture : pourquoi votre mois ne finit pas le 31",
      "Avec une carte à débit différé, le solde du 31 ne dit pas encore ce que le mois a coûté.",
    ),
  },
  {
    slug: "pea-cto-assurance-vie-per" as const,
    meta: meta(
      "PEA, CTO, assurance-vie, PER : ce qu'est chaque enveloppe",
      "Quatre façons de détenir des placements en France.",
    ),
  },
];

describe("matchGuides", () => {
  it("finds the guide a question is about, accents or not", () => {
    expect(
      matchGuides("Ma carte à debit differe, quel jour de lecture ?", guides),
    ).toEqual([{ slug: "jour-de-lecture", title: guides[0]!.meta.title }]);
  });

  it("says nothing on one shared word, or none", () => {
    expect(matchGuides("Une question sur la carte", guides)).toEqual([]);
    expect(matchGuides("le la les", guides)).toEqual([]);
  });
});
