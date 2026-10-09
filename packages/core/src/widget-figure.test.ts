import { describe, expect, it } from "vitest";

import type { LeftToSpend } from "./left-to-spend";
import {
  parseWidgetFigure,
  widgetFace,
  type WidgetFigure,
} from "./widget-figure";

const LEFT: LeftToSpend = {
  amount: 412,
  through: "2026-10-27",
  payDay: "2026-10-28",
  days: 19,
  perDay: 21.68,
  marge: 95,
};

function face(
  figure: WidgetFigure | null,
  options: { today?: string; hidden?: boolean } = {},
) {
  return widgetFace({
    figure,
    today: options.today ?? "2026-10-09",
    hidden: options.hidden ?? false,
    locale: "fr",
    currency: "EUR",
  });
}

describe("widgetFace", () => {
  it("says the figure as Le point does", () => {
    expect(face({ left: LEFT, readOn: "2026-10-09" })).toEqual({
      kind: "figure",
      title: "Il vous reste",
      amount: "412 €",
      until: "jusqu'au 28 oct.",
      perDay: "soit 21,68 € par jour",
      add: "Ajouter une dépense",
      bearing: "Le point",
    });
  });

  it("says what is missing below zero, without a minus", () => {
    const shown = face({
      left: { ...LEFT, amount: -80, perDay: null },
      readOn: "2026-10-09",
    });
    expect(shown).toMatchObject({
      kind: "figure",
      title: "Il vous manque",
      amount: "80 €",
      until: "d'ici le 28 oct.",
      perDay: null,
    });
  });

  it("runs to the month's end with no income set", () => {
    const shown = face({
      left: { ...LEFT, payDay: null, through: "2026-10-31" },
      readOn: "2026-10-09",
    });
    expect(shown).toMatchObject({ until: "jusqu'à la fin du mois" });
  });

  it("keeps only the ways in with the privacy blur on", () => {
    expect(
      face({ left: LEFT, readOn: "2026-10-09" }, { hidden: true }),
    ).toEqual({
      kind: "bare",
      add: "Ajouter une dépense",
      bearing: "Le point",
    });
  });

  it("does not show yesterday's figure", () => {
    expect(
      face({ left: LEFT, readOn: "2026-10-08" }, { today: "2026-10-09" }).kind,
    ).toBe("bare");
  });

  it("keeps only the ways in with no figure", () => {
    expect(face({ left: null, readOn: "2026-10-09" }).kind).toBe("bare");
    expect(face(null).kind).toBe("bare");
  });

  it("speaks English for an English phone", () => {
    const shown = widgetFace({
      figure: { left: LEFT, readOn: "2026-10-09" },
      today: "2026-10-09",
      hidden: false,
      locale: "en",
      currency: "EUR",
    });
    expect(shown).toMatchObject({
      kind: "figure",
      title: "You have",
      amount: "€412",
      add: "Add a spend",
      bearing: "Overview",
    });
  });
});

describe("parseWidgetFigure", () => {
  it("reads back what was stored", () => {
    const stored: WidgetFigure = { left: LEFT, readOn: "2026-10-09" };
    expect(parseWidgetFigure(JSON.stringify(stored))).toEqual(stored);
    expect(
      parseWidgetFigure(JSON.stringify({ left: null, readOn: "2026-10-09" })),
    ).toEqual({ left: null, readOn: "2026-10-09" });
  });

  it("refuses anything else", () => {
    expect(parseWidgetFigure(null)).toBeNull();
    expect(parseWidgetFigure("not json")).toBeNull();
    expect(parseWidgetFigure("42")).toBeNull();
    expect(parseWidgetFigure(JSON.stringify({ left: LEFT }))).toBeNull();
    expect(
      parseWidgetFigure(
        JSON.stringify({ left: { amount: "412" }, readOn: "2026-10-09" }),
      ),
    ).toBeNull();
  });
});
