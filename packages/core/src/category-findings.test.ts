import { describe, expect, it } from "vitest";

import { buildCategoryHistory } from "./category-history";
import {
  buildCategoryFindings,
  categoryNormal,
  findingIsGoodNews,
} from "./category-findings";
import type { CategoryType, TransactionWithCategory } from "./types/database";

/** One transaction, with only the fields a history needs. */
function tx(
  occurredOn: string,
  amount: number,
  categoryId = "cat-groceries",
  name = "Groceries",
  type: CategoryType = "expense",
  counts_toward_summary = true,
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
    categories: { name, type, icon: null, counts_toward_summary },
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
  counts_toward_summary = true,
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
    out.push(tx(iso, amount, categoryId, name, type, counts_toward_summary));
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

describe("buildCategoryFindings, gone quiet", () => {
  it("reports a steady charge that stopped", () => {
    const findings = findingsFor(
      run([34, 34, 34, 34, 34, 34, null, null, null]),
    );

    const quiet = findings.find((f) => f.kind === "gone-quiet");
    expect(quiet).toBeDefined();
    expect(quiet!.direction).toBe("down");
    expect(quiet!.messageKey).toBe("categoryFindings.goneQuiet");
    expect(quiet!.severity).toBe(34);
  });

  it("says nothing about a category that was never steady", () => {
    const findings = findingsFor(
      run([80, null, null, 90, null, null, null, null, null]),
    );

    expect(findings.filter((f) => f.kind === "gone-quiet")).toEqual([]);
  });

  it("reports a category that has just appeared", () => {
    const findings = findingsFor(
      run([null, null, null, null, null, null, 120, 118, 122]),
    );

    const quiet = findings.find((f) => f.kind === "gone-quiet");
    expect(quiet!.direction).toBe("up");
    expect(quiet!.messageKey).toBe("categoryFindings.appeared");
  });

  it("does not read a salary straddling a month end as a silence", () => {
    // Every one of these periods holds exactly one payment; on a calendar
    // they look like doubles and holes. buildCategoryHistory regroups them.
    const dates = [
      "2025-10-31",
      "2025-12-01",
      "2025-12-31",
      "2026-02-01",
      "2026-02-28",
      "2026-03-31",
      "2026-05-01",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-10-01",
    ];
    const findings = buildCategoryFindings(
      buildCategoryHistory(
        dates.map((date) => tx(date, 4500, "pay", "Salary", "income")),
        2026,
        9,
        { months: 36 },
      ),
    );

    expect(findings.filter((f) => f.kind === "gone-quiet")).toEqual([]);
    expect(findings.filter((f) => f.kind === "odd-month")).toEqual([]);
  });

  it("carries positive severity even when a category has negative totals", () => {
    // A savings category with counts_toward_summary: false gets negated by
    // buildCategoryHistory. Severity must still be positive: it measures the
    // magnitude of the run that stopped, not its sign.
    const findings = findingsFor(
      run(
        [50, 50, 50, 50, 50, 50, null, null, null],
        "cat-savings",
        "Savings",
        "savings",
        false,
      ),
    );

    const quiet = findings.find((f) => f.kind === "gone-quiet");
    expect(quiet).toBeDefined();
    expect(quiet!.direction).toBe("down");
    expect(quiet!.severity).toBe(50);
    expect(quiet!.severity).toBeGreaterThan(0);
  });
});

describe("buildCategoryFindings, every year", () => {
  /** Thirty-six months, with `high` added every December and September. */
  function seasonal(base: number, high: number): TransactionWithCategory[] {
    const out: TransactionWithCategory[] = [];
    for (let back = 35; back >= 0; back -= 1) {
      const date = new Date(Date.UTC(2026, 8 - back, 4));
      const month = date.getUTCMonth() + 1;
      const amount = month === 12 || month === 9 ? high : base;
      out.push(
        tx(
          date.toISOString().slice(0, 10),
          amount,
          "cat-energy",
          "Energy",
          "expense",
        ),
      );
    }
    return out;
  }

  it("does not call a September that is high every year a drift", () => {
    const findings = findingsFor(seasonal(100, 400));

    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
    expect(findings.filter((f) => f.kind === "odd-month")).toEqual([]);
  });

  it("says instead that this month runs high every year", () => {
    const findings = findingsFor(seasonal(100, 400));

    const season = findings.find((f) => f.kind === "every-year");
    expect(season).toBeDefined();
    expect(season!.months).toEqual(["2026-09"]);
    expect(season!.messageKey).toBe("categoryFindings.everyYear");
  });

  it("still reports a spike in a month that is not seasonal", () => {
    const transactions = seasonal(100, 400).filter(
      (entry) => !entry.occurred_on.startsWith("2026-07"),
    );
    transactions.push(tx("2026-07-04", 900, "cat-energy", "Energy"));

    const findings = buildCategoryFindings(
      buildCategoryHistory(transactions, 2026, 9, { months: 36 }),
    );

    const odd = findings.find((f) => f.kind === "odd-month");
    expect(odd!.months).toEqual(["2026-07"]);
  });

  it("will not call one year's September a pattern", () => {
    // Twelve months: this September is high, and there is no earlier one to
    // say it is high every year. One occurrence is a month, not a pattern.
    const findings = buildCategoryFindings(
      buildCategoryHistory(seasonal(100, 400), 2026, 9, { months: 12 }),
    );

    expect(findings.some((f) => f.kind === "every-year")).toBe(false);
  });

  it("keeps a multi-month drift that only partly overlaps a seasonal month", () => {
    // Every September runs high, every year — seasonal. Only this year's
    // July and August also ran high: 2024 and 2025 did not, so July and
    // August are not seasonal, only recently elevated. The drift's three
    // months are July, August, September, and only one of them is seasonal,
    // so the demotion — which requires every month to be seasonal — must
    // not touch it.
    const out: TransactionWithCategory[] = [];
    for (let back = 35; back >= 0; back -= 1) {
      const date = new Date(Date.UTC(2026, 8 - back, 4));
      const key = date.toISOString().slice(0, 7);
      const month = date.getUTCMonth() + 1;
      const amount =
        month === 9 ? 400 : key === "2026-07" || key === "2026-08" ? 300 : 100;
      out.push(
        tx(
          date.toISOString().slice(0, 10),
          amount,
          "cat-energy",
          "Energy",
          "expense",
        ),
      );
    }

    const findings = findingsFor(out);

    const drift = findings.find((f) => f.kind === "drift");
    expect(drift).toBeDefined();
    expect(drift!.direction).toBe("up");
    expect(drift!.months).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("demotes a drift whose every month is itself seasonal", () => {
    // Every July, August and September runs high, every year, this time —
    // the same three months look like a fresh drift only because
    // driftFinding never looks past the current year's own baseline. All
    // three of the drift's months are seasonal here, so the demotion does
    // apply and nothing is left to report.
    const out: TransactionWithCategory[] = [];
    for (let back = 35; back >= 0; back -= 1) {
      const date = new Date(Date.UTC(2026, 8 - back, 4));
      const month = date.getUTCMonth() + 1;
      const amount =
        month === 9 ? 400 : month === 7 || month === 8 ? 300 : 100;
      out.push(
        tx(
          date.toISOString().slice(0, 10),
          amount,
          "cat-energy",
          "Energy",
          "expense",
        ),
      );
    }

    const findings = findingsFor(out);

    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
  });

  it("treats two years of the same high month as seasonal, not only three", () => {
    // Twenty-four months: every September in this window — there are only
    // two, 2025 and 2026 — runs high. SEASON_YEARS = 2 is the claim that
    // two occurrences already make a pattern. Paired with the twelve-month
    // test above, which shows one occurrence does not, this pins the
    // constant on both sides.
    const out: TransactionWithCategory[] = [];
    for (let back = 23; back >= 0; back -= 1) {
      const date = new Date(Date.UTC(2026, 8 - back, 4));
      const month = date.getUTCMonth() + 1;
      const amount = month === 9 ? 400 : 100;
      out.push(
        tx(
          date.toISOString().slice(0, 10),
          amount,
          "cat-energy",
          "Energy",
          "expense",
        ),
      );
    }

    const findings = buildCategoryFindings(
      buildCategoryHistory(out, 2026, 9, { months: 24 }),
    );

    expect(findings.filter((f) => f.kind === "odd-month")).toEqual([]);
    expect(findings.filter((f) => f.kind === "drift")).toEqual([]);
    const season = findings.find((f) => f.kind === "every-year");
    expect(season).toBeDefined();
    expect(season!.months).toEqual(["2026-09"]);
  });
});

describe("findingIsGoodNews", () => {
  /** A finding of the shape the colouring reads, and nothing else. */
  const finding = (type: CategoryType, direction: "up" | "down") => ({
    type,
    direction,
  });

  it("reads a rise as bad in spending and good in everything else", () => {
    expect(findingIsGoodNews(finding("expense", "up"))).toBe(false);
    expect(findingIsGoodNews(finding("income", "up"))).toBe(true);
    expect(findingIsGoodNews(finding("savings", "up"))).toBe(true);
    expect(findingIsGoodNews(finding("investment", "up"))).toBe(true);
  });

  it("reads a salary that stopped arriving as bad news", () => {
    // The failure this exists to stop: a `gone-quiet` on an income category
    // carries direction "down", and a screen colouring "down" green would
    // congratulate somebody on not being paid.
    expect(findingIsGoodNews(finding("income", "down"))).toBe(false);
    expect(findingIsGoodNews(finding("expense", "down"))).toBe(true);
  });
});
