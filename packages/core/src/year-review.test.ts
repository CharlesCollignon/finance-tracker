import { describe, expect, it } from "vitest";

import { formatEuro } from "./constants";
import { translator } from "./i18n/t";
import {
  buildYearReview,
  reviewedYear,
  yearReviewCards,
  type YearReviewRow,
} from "./year-review";

function row(
  occurredOn: string,
  amount: number,
  categoryName: string,
  categoryType: YearReviewRow["categoryType"] = "expense",
): YearReviewRow {
  return { occurredOn, amount, categoryName, categoryType };
}

const ROWS: YearReviewRow[] = [
  row("2025-03-10", 2000, "Salaire", "income"),
  row("2025-03-12", 400, "Restaurants"),
  row("2025-03-15", 900, "Courses"),
  row("2026-03-10", 2400, "Salaire", "income"),
  row("2026-03-12", 300, "Restaurants"),
  row("2026-03-15", 950, "Courses"),
];

describe("buildYearReview", () => {
  it("is null for a year with nothing in it", () => {
    expect(
      buildYearReview({ year: 2024, closes: [], rows: ROWS, milestones: [] }),
    ).toBeNull();
  });

  it("keeps what the closes kept, as a share of the income", () => {
    const review = buildYearReview({
      year: 2026,
      closes: [
        { monthKey: "2026-02", kept: null, won: false },
        { monthKey: "2026-03", kept: 300, won: true },
        { monthKey: "2026-04", kept: 180, won: true },
      ],
      rows: ROWS,
      milestones: [],
    });
    expect(review?.kept).toEqual({ amount: 480, rate: 0.2, source: "closes" });
    expect(review?.closes).toEqual({ count: 3, bestRun: 2 });
  });

  it("falls back on income less spending without a close", () => {
    const review = buildYearReview({
      year: 2026,
      closes: [],
      rows: ROWS,
      milestones: [],
    });
    expect(review?.kept).toEqual({
      amount: 1150,
      rate: 0.479,
      source: "recorded",
    });
  });

  it("names the category that moved most against the year before", () => {
    const review = buildYearReview({
      year: 2026,
      closes: [],
      rows: ROWS,
      milestones: [],
    });
    expect(review?.category).toEqual({
      kind: "change",
      name: "Restaurants",
      change: -0.25,
      before: 400,
      after: 300,
    });
  });

  it("names the largest share without a year before", () => {
    const review = buildYearReview({
      year: 2026,
      closes: [],
      rows: ROWS.filter((r) => r.occurredOn.startsWith("2026")),
      milestones: [],
    });
    expect(review?.category).toEqual({
      kind: "share",
      name: "Courses",
      share: 0.76,
      amount: 950,
    });
  });

  it("lists the milestones reached in the year", () => {
    const review = buildYearReview({
      year: 2026,
      closes: [],
      rows: ROWS,
      milestones: [
        { amount: 25000, on: "2026-11-02" },
        { amount: 10000, on: "2025-06-01" },
        { amount: 20000, on: "2026-04-18" },
      ],
    });
    expect(review?.milestones).toEqual([20000, 25000]);
  });

  it("breaks a run on a month lost or skipped", () => {
    const review = buildYearReview({
      year: 2026,
      closes: [
        { monthKey: "2026-01", kept: 10, won: true },
        { monthKey: "2026-02", kept: 10, won: true },
        { monthKey: "2026-04", kept: 10, won: true },
        { monthKey: "2026-05", kept: -10, won: false },
      ],
      rows: [],
      milestones: [],
    });
    expect(review?.closes.bestRun).toBe(2);
    expect(
      review?.months
        .filter((month) => month.inBestRun)
        .map((month) => month.monthKey),
    ).toEqual(["2026-01", "2026-02"]);
    expect(review?.months[2]).toMatchObject({ closed: false, won: false });
  });
});

describe("reviewedYear", () => {
  it("is the year before, in January only", () => {
    expect(reviewedYear("2027-01-02")).toBe(2026);
    expect(reviewedYear("2027-02-01")).toBeNull();
  });
});

describe("yearReviewCards", () => {
  const review = buildYearReview({
    year: 2026,
    closes: [
      { monthKey: "2026-03", kept: 300, won: true },
      { monthKey: "2026-04", kept: 180, won: true },
    ],
    rows: ROWS,
    milestones: [{ amount: 20000, on: "2026-04-18" }],
  })!;
  const t = translator("fr");

  it("tells the year with its amounts in the app", () => {
    const cards = yearReviewCards(review, {
      t,
      locale: "fr",
      formatMoney: (amount) => formatEuro(amount, "fr"),
    });
    expect(cards.map((card) => card.id)).toEqual([
      "kept",
      "closes",
      "category",
      "milestones",
    ]);
    expect(cards[0]!.figure).toContain("480");
    expect(cards[1]!.note).toBe("Série la plus longue : 2 mois");
  });

  it("shares no amount", () => {
    const cards = yearReviewCards(review, {
      t,
      locale: "fr",
      formatMoney: null,
    });
    const text = cards
      .flatMap((card) => [card.figure, card.caption, card.note ?? ""])
      .join(" ");
    expect(text).not.toMatch(/€|480|20\s?000/);
    expect(cards[0]).toMatchObject({ id: "kept", figure: "20 %" });
  });
});
