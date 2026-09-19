import { describe, expect, it } from "vitest";

import { buildCategoryHistory } from "./category-history";
import { buildCategoryFindings, categoryNormal } from "./category-findings";
import type { CategoryType, TransactionWithCategory } from "./types/database";

/** One transaction, with only the fields a history needs. */
function tx(
  occurredOn: string,
  amount: number,
  categoryId = "cat-groceries",
  name = "Groceries",
  type: CategoryType = "expense",
): TransactionWithCategory {
  return {
    id: `tx-${occurredOn}-${amount}-${categoryId}`,
    user_id: "u",
    category_id: categoryId,
    recurring_template_id: null,
    occurred_on: occurredOn,
    amount,
    note: null,
    created_at: `${occurredOn}T00:00:00.000Z`,
    categories: { name, type, icon: null, counts_toward_summary: true },
  };
}

/**
 * One payment on the 4th of each of the months ending at 2026-09, oldest
 * first. `amounts` shorter than the window leaves the earlier months empty.
 */
function run(
  amounts: (number | null)[],
  categoryId = "cat-groceries",
  name = "Groceries",
  type: CategoryType = "expense",
): TransactionWithCategory[] {
  const out: TransactionWithCategory[] = [];
  const count = amounts.length;
  amounts.forEach((amount, index) => {
    if (amount === null) {
      return;
    }
    const back = count - 1 - index;
    const date = new Date(Date.UTC(2026, 8 - back, 4));
    const iso = date.toISOString().slice(0, 10);
    out.push(tx(iso, amount, categoryId, name, type));
  });
  return out;
}

function findingsFor(transactions: TransactionWithCategory[]) {
  return buildCategoryFindings(
    buildCategoryHistory(transactions, 2026, 9, { months: 36 }),
  );
}

describe("categoryNormal", () => {
  it("takes the median, so one monstrous month does not become the normal", () => {
    const [history] = buildCategoryHistory(
      run([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 2000]),
      2026,
      9,
      { months: 36 },
    );

    const { normal } = categoryNormal(history!.points);
    // The mean would be about 258.
    expect(normal).toBe(100);
  });

  it("ignores months with nothing in them", () => {
    const [history] = buildCategoryHistory(
      run([null, null, null, 200, 200, 200]),
      2026,
      9,
      { months: 36 },
    );

    expect(categoryNormal(history!.points).normal).toBe(200);
  });
});

describe("buildCategoryFindings, drift", () => {
  it("reports a category that has climbed for three months", () => {
    const findings = findingsFor(
      run([300, 300, 300, 300, 300, 300, 420, 440, 460]),
    );

    const drift = findings.find((f) => f.kind === "drift");
    expect(drift).toBeDefined();
    expect(drift!.direction).toBe("up");
    expect(drift!.categoryId).toBe("cat-groceries");
    expect(drift!.messageKey).toBe("categoryFindings.driftUp");
    // 440 (median of the last three) against 300: 140 a month.
    expect(drift!.severity).toBe(140);
  });

  it("says nothing about a large percentage of a small amount", () => {
    // 40% up, and four euros a month. Real, and not worth a sentence.
    const findings = findingsFor(run([10, 10, 10, 10, 10, 10, 14, 14, 14]));

    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
  });

  it("says nothing about a large amount that barely moved", () => {
    // 60 euros a month on a 1200 baseline: five percent, under the floor.
    const findings = findingsFor(
      run([1200, 1200, 1200, 1200, 1200, 1200, 1260, 1260, 1260]),
    );

    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
  });

  it("refuses to call anything normal on two months of history", () => {
    const findings = findingsFor(run([300, 900]));

    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
  });

  it("reads a fall as a fall", () => {
    const findings = findingsFor(
      run([400, 400, 400, 400, 400, 400, 240, 230, 250]),
    );

    const drift = findings.find((f) => f.kind === "drift");
    expect(drift!.direction).toBe("down");
    expect(drift!.messageKey).toBe("categoryFindings.driftDown");
  });

  it("puts the heaviest finding first", () => {
    const findings = findingsFor([
      ...run([300, 300, 300, 300, 300, 300, 420, 440, 460]),
      ...run(
        [1000, 1000, 1000, 1000, 1000, 1000, 1500, 1520, 1540],
        "cat-rent",
        "Rent",
      ),
    ]);

    expect(findings[0]!.categoryId).toBe("cat-rent");
  });
});

describe("buildCategoryFindings, odd month", () => {
  it("names the one month that stands apart", () => {
    const findings = findingsFor(
      run([200, 210, 195, 205, 200, 190, 205, 195, 900]),
    );

    const odd = findings.find((f) => f.kind === "odd-month");
    expect(odd).toBeDefined();
    expect(odd!.months).toEqual(["2026-09"]);
    expect(odd!.direction).toBe("up");
    expect(odd!.messageKey).toBe("categoryFindings.oddMonthHigh");
    // 900 against a normal of 200.
    expect(odd!.severity).toBe(700);
  });

  it("is not fooled into hiding the spike inside its own spread", () => {
    // A standard deviation over this run is large enough to swallow the
    // 900. A median absolute deviation is not.
    const findings = findingsFor(
      run([200, 200, 200, 200, 200, 200, 200, 200, 900]),
    );

    expect(findings.some((f) => f.kind === "odd-month")).toBe(true);
  });

  it("says nothing about a small category having a slightly odd month", () => {
    const findings = findingsFor(run([8, 9, 8, 9, 8, 9, 8, 9, 30]));

    expect(findings.filter((f) => f.kind === "odd-month")).toEqual([]);
  });

  it("reports a month well below the normal too", () => {
    const findings = findingsFor(
      run([400, 410, 395, 405, 400, 390, 405, 395, 40]),
    );

    const odd = findings.find((f) => f.kind === "odd-month");
    expect(odd!.direction).toBe("down");
    expect(odd!.messageKey).toBe("categoryFindings.oddMonthLow");
  });

  it("reports at most the oddest month, not every month above normal", () => {
    const findings = findingsFor(
      run([200, 200, 200, 200, 200, 200, 800, 200, 900]),
    );

    expect(findings.filter((f) => f.kind === "odd-month")).toHaveLength(1);
    expect(findings.find((f) => f.kind === "odd-month")!.months).toEqual([
      "2026-09",
    ]);
  });
});
