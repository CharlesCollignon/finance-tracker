import { describe, expect, it } from "vitest";

import {
  estimateMonthlyAmount,
  formatRecurrenceSchedule,
  getRecurringOccurrenceDates,
  isSpreadExpense,
  monthsEvery,
  normaliseMonths,
  rhythmOfMonths,
  timesPerYear,
} from "./recurrence";

const monthly = {
  recurrence: "monthly" as const,
  day_of_month: 15,
  day_of_week: null,
  month_of_year: null,
};

describe("normaliseMonths", () => {
  it("sorts and dedupes", () => {
    expect(normaliseMonths([10, 1, 4, 7, 4])).toEqual([1, 4, 7, 10]);
  });

  it("keeps every month as null, never all twelve", () => {
    expect(normaliseMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBeNull();
    expect(normaliseMonths([])).toBeNull();
    expect(normaliseMonths(null)).toBeNull();
  });

  it("drops what is not a month", () => {
    expect(normaliseMonths([0, 3, 13, 2.5])).toEqual([3]);
  });
});

describe("monthsEvery", () => {
  it("is every month for a step of one", () => {
    expect(monthsEvery(1, 5)).toBeNull();
  });

  it("goes round the whole year from any first month", () => {
    expect(monthsEvery(3, 1)).toEqual([1, 4, 7, 10]);
    expect(monthsEvery(3, 11)).toEqual([2, 5, 8, 11]);
    expect(monthsEvery(2, 2)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(monthsEvery(6, 12)).toEqual([6, 12]);
  });
});

describe("rhythmOfMonths", () => {
  it("reads every month back", () => {
    expect(rhythmOfMonths(null)).toEqual({ rhythm: 1, first: 1 });
  });

  it("reads an evenly spaced set as its step", () => {
    expect(rhythmOfMonths([2, 5, 8, 11])).toEqual({ rhythm: 3, first: 2 });
    expect(rhythmOfMonths([1, 3, 5, 7, 9, 11])).toEqual({
      rhythm: 2,
      first: 1,
    });
    expect(rhythmOfMonths([6, 12])).toEqual({ rhythm: 6, first: 6 });
  });

  it("reads anything else as some months", () => {
    expect(rhythmOfMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual({
      rhythm: "some",
      first: 1,
    });
  });
});

describe("a monthly template kept to some months", () => {
  const quarterly = { ...monthly, months: [1, 4, 7, 10] };

  it("falls only in its months", () => {
    expect(getRecurringOccurrenceDates(quarterly, 2026, 4)).toEqual([
      "2026-04-15",
    ]);
    expect(getRecurringOccurrenceDates(quarterly, 2026, 5)).toEqual([]);
  });

  it("falls every month without a set", () => {
    expect(getRecurringOccurrenceDates(monthly, 2026, 5)).toEqual([
      "2026-05-15",
    ]);
  });

  it("is spread over the year as a monthly amount", () => {
    expect(estimateMonthlyAmount({ ...quarterly, amount: 300 }, 2026, 5)).toBe(
      100,
    );
    expect(
      estimateMonthlyAmount({
        ...monthly,
        months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        amount: 120,
      }),
    ).toBe(100);
  });

  it("counts how often it comes in a year", () => {
    expect(timesPerYear(quarterly)).toBe(4);
    expect(timesPerYear(monthly)).toBe(12);
    expect(timesPerYear({ recurrence: "yearly" })).toBe(1);
    expect(timesPerYear({ recurrence: "weekly" })).toBe(52);
  });

  it("is a spread expense, and income is never spread", () => {
    expect(
      isSpreadExpense({ ...quarterly, categories: { type: "expense" } }),
    ).toBe(true);
    expect(
      isSpreadExpense({ ...quarterly, categories: { type: "income" } }),
    ).toBe(false);
    expect(
      isSpreadExpense({ ...monthly, categories: { type: "expense" } }),
    ).toBe(false);
  });
});

describe("formatRecurrenceSchedule with months", () => {
  it("names a quarter and its months", () => {
    expect(
      formatRecurrenceSchedule({ ...monthly, months: [1, 4, 7, 10] }, "fr"),
    ).toBe("Trimestriel · le 15 (janv., avr., juil., oct.)");
    expect(
      formatRecurrenceSchedule({ ...monthly, months: [1, 4, 7, 10] }, "en"),
    ).toBe("Quarterly · day 15 (Jan, Apr, Jul, Oct)");
  });

  it("names the months skipped when they are fewer", () => {
    expect(
      formatRecurrenceSchedule(
        { ...monthly, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        "fr",
      ),
    ).toBe("Mensuel sauf nov., déc. · le 15");
  });

  it("names a few uneven months", () => {
    expect(
      formatRecurrenceSchedule({ ...monthly, months: [3, 9, 10] }, "fr"),
    ).toBe("Certains mois · le 15 (mars, sept., oct.)");
  });

  it("is unchanged for every month", () => {
    expect(formatRecurrenceSchedule(monthly, "fr")).toBe("Mensuel · le 15");
  });
});
