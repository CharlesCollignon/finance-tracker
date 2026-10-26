import { describe, expect, it } from "vitest";
import { translator } from "./i18n/t";
import { monthShare, type MonthShareInput } from "./month-share";

const t = translator("fr");
const money = (amount: number) => `${amount.toFixed(2)} €`;

const october: MonthShareInput = {
  year: 2026,
  month: 10,
  income: 2400,
  spent: 1850.5,
  spending: {
    top: [
      { name: "Courses", amount: 600 },
      { name: "Loyer", amount: 900 },
    ],
    rest: 350.5,
    total: 1850.5,
  },
  close: { kept: 500, unrecorded: 48 },
  upcoming: null,
};

describe("monthShare", () => {
  it("says the month's figures when amounts are wanted", () => {
    const share = monthShare(october, { t, locale: "fr", formatMoney: money });
    expect(share.title).toBe("Relevé d'octobre 2026");
    expect(share.lines.map((line) => line.id)).toEqual([
      "income",
      "spent",
      "net",
      "kept",
      "unrecorded",
    ]);
    expect(share.lines[2]!.figure).toBe("+549.50 €");
    expect(share.categories.map((c) => c.name)).toEqual([
      "Courses",
      "Loyer",
      "Tout le reste",
    ]);
    expect(share.categories[0]!.figure).toBe("600.00 €");
  });

  it("keeps every amount out of the version to share without them", () => {
    const share = monthShare(october, { t, locale: "fr", formatMoney: null });
    expect(share.lines.map((line) => line.id)).toEqual(["net", "kept"]);
    expect(share.lines[0]!.figure).toBe(t("monthShare.netAhead"));
    expect(share.lines[1]!.figure).toContain("21");
    for (const category of share.categories) {
      expect(category.figure).toContain("%");
      expect(category.figure).not.toContain("€");
    }
  });

  it("adds what is still to come for a month in progress", () => {
    const share = monthShare(
      { ...october, close: null, upcoming: { leaving: 300, arriving: 0 } },
      { t, locale: "fr", formatMoney: money },
    );
    expect(share.lines.at(-1)).toMatchObject({ id: "upcoming", figure: "300.00 €" });
  });
});
