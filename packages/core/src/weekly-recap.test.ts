import { describe, expect, it } from "vitest";

import { translator } from "./i18n/t";
import { weeklyRecapNotification } from "./push-messages";
import type { TransactionWithCategory } from "./types/database";
import { buildWeeklyRecap, mondayOf, weeklyRecapLines } from "./weekly-recap";

function tx(
  occurredOn: string,
  amount: number,
  name = "Courses",
  type: "expense" | "income" = "expense",
): TransactionWithCategory {
  return {
    id: `${occurredOn}-${amount}-${name}`,
    user_id: "u",
    category_id: name,
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount,
    note: null,
    created_at: `${occurredOn}T10:00:00.000Z`,
    cash_on: null,
    deleted_at: null,
    categories: { name, type, icon: null, counts_toward_summary: true },
  };
}

const nothingToCome = { outgoing: [], leaving: 0 };

describe("mondayOf", () => {
  it("finds the Monday of the week, Sunday included", () => {
    expect(mondayOf("2026-10-05")).toBe("2026-10-05"); // a Monday
    expect(mondayOf("2026-10-07")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // a Sunday
  });
});

describe("buildWeeklyRecap", () => {
  it("sums last week, Monday to Sunday", () => {
    const recap = buildWeeklyRecap({
      today: "2026-10-12",
      transactions: [
        tx("2026-10-04", 999), // the week before
        tx("2026-10-05", 40),
        tx("2026-10-11", 60),
        tx("2026-10-12", 500), // this week
        tx("2026-10-06", 2000, "Salaire", "income"),
      ],
      stillToCome: nothingToCome,
      waiting: 0,
      locale: "fr",
    });
    expect(recap?.weekOf).toBe("2026-10-12");
    expect(recap?.lastWeek).toEqual({
      from: "2026-10-05",
      to: "2026-10-11",
      spent: 100,
    });
  });

  it("compares the month to yesterday with last month to the same day", () => {
    const recap = buildWeeklyRecap({
      today: "2026-10-12",
      transactions: [
        tx("2026-10-03", 300),
        tx("2026-09-04", 200),
        tx("2026-09-20", 900), // after the 11th: not counted
      ],
      stillToCome: nothingToCome,
      waiting: 0,
      locale: "fr",
    });
    expect(recap?.monthSoFar).toMatchObject({
      spent: 300,
      previous: 200,
      comparable: true,
      previousMonth: 9,
    });
  });

  it("names a category already above its normal month", () => {
    const history = [3, 4, 5, 6, 7, 8, 9].map((month) =>
      tx(`2026-0${month}-10`, 100),
    );
    const recap = buildWeeklyRecap({
      today: "2026-10-20",
      transactions: [...history, tx("2026-10-02", 180)],
      stillToCome: nothingToCome,
      waiting: 0,
      locale: "fr",
    });
    expect(recap?.aboveNormal).toEqual([
      { categoryName: "Courses", spent: 180, normal: 100 },
    ]);
  });

  it("says nothing about a week with nothing in it", () => {
    expect(
      buildWeeklyRecap({
        today: "2026-10-12",
        transactions: [],
        stillToCome: nothingToCome,
        waiting: 0,
        locale: "fr",
      }),
    ).toBeNull();
  });
});

describe("the recap's words", () => {
  it("reads as a push in French", () => {
    const recap = buildWeeklyRecap({
      today: "2026-10-12",
      transactions: [tx("2026-10-06", 120), tx("2026-09-06", 200)],
      stillToCome: { outgoing: [{} as never, {} as never], leaving: 640 },
      waiting: 3,
      locale: "fr",
    })!;
    const push = weeklyRecapNotification({
      recap,
      t: translator("fr"),
      locale: "fr",
    });
    expect(push.key).toBe("recap:2026-10-12");
    expect(push.title).toBe("Votre semaine");
    expect(push.body).toContain("la semaine dernière");
    expect(push.body).toContain("de moins qu'à la même date en septembre");
    expect(push.body).toContain("2 opérations");
    expect(push.body).toContain("3 opérations de votre banque");
  });

  it("lists one line per fact for the card", () => {
    const recap = buildWeeklyRecap({
      today: "2026-10-12",
      transactions: [tx("2026-10-06", 120)],
      stillToCome: nothingToCome,
      waiting: 0,
      locale: "fr",
    })!;
    const lines = weeklyRecapLines(recap, {
      t: translator("fr"),
      formatMoney: (amount) => `${amount} €`,
      previousMonthName: "septembre",
    });
    expect(lines[0]).toBe("120 € dépensés la semaine dernière.");
  });
});
