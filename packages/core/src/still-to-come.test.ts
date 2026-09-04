import { describe, expect, it } from "vitest";

import { buildStillToCome } from "./still-to-come";
import { buildMonthlySummary } from "./monthly-summary";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "./types/database";

function tx(
  id: string,
  occurredOn: string,
  amount: number,
  type: CategoryType,
  options: {
    templateId?: string | null;
    counts?: boolean;
    name?: string;
  } = {},
): TransactionWithCategory {
  return {
    id,
    user_id: "u",
    category_id: `cat-${type}`,
    recurring_template_id: options.templateId ?? null,
    occurred_on: occurredOn,
    amount,
    note: null,
    created_at: "2026-09-01T00:00:00Z",
    categories: {
      name: options.name ?? type,
      type,
      icon: null,
      counts_toward_summary: options.counts ?? true,
    },
  };
}

function template(
  id: string,
  day: number,
  amount: number,
  type: CategoryType,
  options: {
    active?: boolean;
    counts?: boolean;
    recurrence?: "monthly" | "weekly" | "yearly";
    name?: string;
  } = {},
): RecurringTemplateWithCategory {
  return {
    id,
    user_id: "u",
    category_id: `cat-${type}`,
    amount,
    day_of_month: day,
    day_of_week: null,
    month_of_year: null,
    recurrence: options.recurrence ?? "monthly",
    active: options.active ?? true,
    description: null,
    pricing_type: "fixed",
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    last_quote_price: null,
    last_quote_at: null,
    starts_on: null,
    ends_on: null,
    created_at: "2026-01-01T00:00:00Z",
    categories: {
      name: options.name ?? type,
      type,
      icon: null,
      counts_toward_summary: options.counts ?? true,
    },
  };
}

const TODAY = "2026-09-10";

describe("buildStillToCome", () => {
  it("owes nothing when every occurrence is behind us", () => {
    const result = buildStillToCome(
      [tx("t1", "2026-09-02", 50, "expense")],
      [template("r1", 2, 50, "expense")],
      2026,
      9,
      TODAY,
    );

    expect(result.outgoing).toEqual([]);
    expect(result.incoming).toEqual([]);
    expect(result.leaving).toBe(0);
  });

  it("lists the occurrences a template still owes, soonest first", () => {
    const result = buildStillToCome(
      [],
      [
        template("r1", 25, 400, "expense", { name: "Rent" }),
        template("r2", 15, 90, "expense", { name: "Transport" }),
      ],
      2026,
      9,
      TODAY,
    );

    expect(result.outgoing.map((c) => c.name)).toEqual(["Transport", "Rent"]);
    expect(result.outgoing.every((c) => c.recorded === false)).toBe(true);
    expect(result.leaving).toBe(490);
  });

  it("does not owe an occurrence already written into the ledger", () => {
    const result = buildStillToCome(
      [tx("t1", "2026-09-15", 90, "expense", { templateId: "r2" })],
      [template("r2", 15, 90, "expense")],
      2026,
      9,
      TODAY,
    );

    expect(result.outgoing).toHaveLength(1);
    expect(result.outgoing[0]!.recorded).toBe(true);
    expect(result.leaving).toBe(90);
  });

  it("does not owe a skipped occurrence", () => {
    const result = buildStillToCome(
      [],
      [template("r2", 15, 90, "expense")],
      2026,
      9,
      TODAY,
      new Set(["r2:2026-09-15"]),
    );

    expect(result.outgoing).toEqual([]);
    expect(result.leaving).toBe(0);
  });

  it("counts a future-dated row that no template owns", () => {
    const result = buildStillToCome(
      [tx("t1", "2026-09-20", 120, "expense", { name: "Dentist" })],
      [],
      2026,
      9,
      TODAY,
    );

    expect(result.outgoing).toHaveLength(1);
    expect(result.outgoing[0]!.name).toBe("Dentist");
    expect(result.leaving).toBe(120);
  });

  it("separates income still to arrive from outflow still to leave", () => {
    const result = buildStillToCome(
      [],
      [
        template("r1", 28, 2000, "income", { name: "Salary" }),
        template("r2", 15, 90, "expense"),
      ],
      2026,
      9,
      TODAY,
    );

    expect(result.arriving).toBe(2000);
    expect(result.incoming.map((c) => c.name)).toEqual(["Salary"]);
    expect(result.leaving).toBe(90);
  });

  it("lists an uncounted broker deployment but keeps it out of the budget", () => {
    const result = buildStillToCome(
      [],
      [template("r1", 20, 400, "investment", { counts: false })],
      2026,
      9,
      TODAY,
    );

    // It leaves the account like any other debit, so a list of what is
    // still to come has to show it.
    expect(result.outgoing).toHaveLength(1);
    expect(result.leaving).toBe(400);
    // The month-end view treats it as tracked rather than spent.
    expect(result.budgetedOutflow).toBe(0);
  });

  it("ignores inactive templates and yearly expenses", () => {
    const result = buildStillToCome(
      [],
      [
        template("r1", 20, 400, "expense", { active: false }),
        template("r2", 20, 300, "expense", { recurrence: "yearly" }),
      ],
      2026,
      9,
      TODAY,
    );

    expect(result.outgoing).toEqual([]);
  });

  /**
   * The figure on Month has to be the difference between the two views of the
   * same month, or the screen contradicts itself: "1 200 € left" in one place
   * and a list of charges that does not account for the gap in another.
   */
  it("totals exactly the gap between the current and month-end views", () => {
    const transactions = [
      tx("t1", "2026-09-02", 1500, "income", { templateId: "r0" }),
      tx("t2", "2026-09-03", 60, "expense"),
      tx("t3", "2026-09-20", 120, "expense", { name: "Dentist" }),
    ];
    const templates = [
      template("r0", 2, 1500, "income"),
      template("r1", 25, 400, "expense"),
      template("r2", 15, 90, "savings"),
      template("r3", 18, 300, "investment", { counts: false }),
    ];

    const current = buildMonthlySummary(
      transactions,
      templates,
      2026,
      9,
      "current",
    );
    const monthEnd = buildMonthlySummary(
      transactions,
      templates,
      2026,
      9,
      "month_end",
    );
    const upcoming = buildStillToCome(transactions, templates, 2026, 9, TODAY);

    const currentOut = current.expenses + current.savings + current.investments;
    const monthEndOut =
      monthEnd.expenses + monthEnd.savings + monthEnd.investments;

    expect(upcoming.budgetedOutflow).toBeCloseTo(monthEndOut - currentOut, 6);
    expect(upcoming.arriving).toBeCloseTo(monthEnd.income - current.income, 6);
  });
});

describe("fulfilled occurrences", () => {
  /**
   * The regression this exists for: with a bank feed a template never writes
   * a transaction, so nothing carried `recurring_template_id` and every
   * charge the bank delivered stayed in the forecast alongside the real
   * movement. A salary was counted twice.
   */
  it("stops forecasting a charge the bank has already delivered", () => {
    const templates = [template("tpl-salary", 28, 3400, "income")];

    const before = buildStillToCome([], templates, 2026, 9, "2026-09-04");
    expect(before.arriving).toBe(3400);

    const after = buildStillToCome(
      [],
      templates,
      2026,
      9,
      "2026-09-04",
      new Set(),
      new Set(["tpl-salary:2026-09-28"]),
    );

    expect(after.arriving).toBe(0);
    expect(after.incoming).toEqual([]);
  });

  it("leaves every other occurrence alone", () => {
    const templates = [
      template("tpl-rent", 20, 780, "expense"),
      template("tpl-phone", 22, 39.99, "expense"),
    ];

    const rest = buildStillToCome(
      [],
      templates,
      2026,
      9,
      "2026-09-04",
      new Set(),
      new Set(["tpl-rent:2026-09-20"]),
    );

    expect(rest.outgoing.map((row) => row.key)).toEqual([
      "tpl-phone:2026-09-22",
    ]);
    expect(rest.leaving).toBe(39.99);
  });

  it("is independent of skipping, which means something else", () => {
    // Both remove an occurrence from the forecast, and the app has to be able
    // to tell "the user cancelled it" from "the bank already paid it".
    const templates = [template("tpl-rent", 20, 780, "expense")];

    const skipped = buildStillToCome(
      [],
      templates,
      2026,
      9,
      "2026-09-04",
      new Set(["tpl-rent:2026-09-20"]),
    );
    const fulfilled = buildStillToCome(
      [],
      templates,
      2026,
      9,
      "2026-09-04",
      new Set(),
      new Set(["tpl-rent:2026-09-20"]),
    );

    expect(skipped.leaving).toBe(0);
    expect(fulfilled.leaving).toBe(0);
  });
});
