import { describe, expect, it } from "vitest";

import {
  buildApplyRecurringPlan,
  recurringOccurrenceKey,
} from "./apply-recurring";
import { createFakeQuoteSource } from "./market/quote-source";
import type { RecurringTemplateWithCategory } from "./types/database";

function template(
  overrides: Partial<RecurringTemplateWithCategory> = {},
): RecurringTemplateWithCategory {
  return {
    id: "tpl-1",
    user_id: "user-1",
    category_id: "cat-1",
    amount: 42,
    day_of_month: 15,
    day_of_week: null,
    month_of_year: null,
    recurrence: "monthly",
    active: true,
    description: "Rent",
    pricing_type: "fixed",
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    last_quote_price: null,
    last_quote_at: null,
    starts_on: null,
    ends_on: null,
    created_at: "2025-12-01T00:00:00.000Z",
    categories: {
      name: "Housing",
      type: "expense",
      icon: null,
      counts_toward_summary: true,
    },
    ...overrides,
  };
}

const noQuotes = () => createFakeQuoteSource({});

describe("buildApplyRecurringPlan", () => {
  it("plans one occurrence for a monthly template", async () => {
    const plan = await buildApplyRecurringPlan(
      [template()],
      new Map(),
      2026,
      1,
      { quotes: noQuotes() },
    );

    expect(plan.toUpdate).toEqual([]);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0]).toMatchObject({
      templateId: "tpl-1",
      occurredOn: "2026-01-15",
      amount: 42,
      note: "Rent",
      categoryId: "cat-1",
    });
  });

  it("skips inactive templates", async () => {
    const plan = await buildApplyRecurringPlan(
      [template({ active: false })],
      new Map(),
      2026,
      1,
      { quotes: noQuotes() },
    );

    expect(plan.toCreate).toEqual([]);
  });

  it("plans nothing when a matching transaction already exists", async () => {
    const existing = new Map([
      [
        recurringOccurrenceKey("tpl-1", "2026-01-15"),
        { id: "tx-1", amount: 42, note: "Rent", category_id: "cat-1" },
      ],
    ]);

    const plan = await buildApplyRecurringPlan(
      [template()],
      existing,
      2026,
      1,
      {
        quotes: noQuotes(),
      },
    );

    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it("ignores sub-cent drift in an existing amount", async () => {
    const existing = new Map([
      [
        recurringOccurrenceKey("tpl-1", "2026-01-15"),
        { id: "tx-1", amount: 42.005, note: "Rent", category_id: "cat-1" },
      ],
    ]);

    const plan = await buildApplyRecurringPlan(
      [template()],
      existing,
      2026,
      1,
      {
        quotes: noQuotes(),
      },
    );

    expect(plan.toUpdate).toEqual([]);
  });

  it("plans an update when the existing amount moved", async () => {
    const existing = new Map([
      [
        recurringOccurrenceKey("tpl-1", "2026-01-15"),
        { id: "tx-1", amount: 30, note: "Rent", category_id: "cat-1" },
      ],
    ]);

    const plan = await buildApplyRecurringPlan(
      [template()],
      existing,
      2026,
      1,
      {
        quotes: noQuotes(),
      },
    );

    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0]).toMatchObject({
      transactionId: "tx-1",
      amount: 42,
      previousAmount: 30,
      previousNote: "Rent",
    });
  });

  it("honours a skipped occurrence", async () => {
    const plan = await buildApplyRecurringPlan(
      [template()],
      new Map(),
      2026,
      1,
      {
        quotes: noQuotes(),
        skippedKeys: new Set([recurringOccurrenceKey("tpl-1", "2026-01-15")]),
      },
    );

    expect(plan.toCreate).toEqual([]);
  });

  it("excludes occurrences outside the template's window", async () => {
    const plan = await buildApplyRecurringPlan(
      [template({ starts_on: "2026-02-01" })],
      new Map(),
      2026,
      1,
      { quotes: noQuotes() },
    );

    expect(plan.toCreate).toEqual([]);
  });

  it("prices a share-based template from the quote source", async () => {
    const quotes = createFakeQuoteSource({ CW8: 25 });
    const plan = await buildApplyRecurringPlan(
      [
        template({
          pricing_type: "shares",
          amount: 0,
          share_count: 4,
          instrument_symbol: "CW8",
          instrument_name: "Amundi MSCI World",
          description: null,
        }),
      ],
      new Map(),
      2026,
      1,
      { quotes },
    );

    expect(quotes.calls).toEqual(["CW8"]);
    expect(plan.toCreate[0]).toMatchObject({
      amount: 100,
      name: "Amundi MSCI World",
    });
  });

  it("drops an occurrence it cannot price at all", async () => {
    const plan = await buildApplyRecurringPlan(
      [
        template({
          pricing_type: "shares",
          amount: 0,
          share_count: 4,
          instrument_symbol: "CW8",
          last_quote_price: null,
        }),
      ],
      new Map(),
      2026,
      1,
      { quotes: noQuotes() },
    );

    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it("plans every weekly occurrence in the month", async () => {
    const plan = await buildApplyRecurringPlan(
      [template({ recurrence: "weekly", day_of_month: null, day_of_week: 1 })],
      new Map(),
      2026,
      1,
      { quotes: noQuotes() },
    );

    expect(plan.toCreate.map((item) => item.occurredOn)).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
    ]);
  });

  it("plans a yearly occurrence only in its month", async () => {
    const yearly = template({
      recurrence: "yearly",
      month_of_year: 3,
      day_of_month: 10,
    });

    const january = await buildApplyRecurringPlan(
      [yearly],
      new Map(),
      2026,
      1,
      {
        quotes: noQuotes(),
      },
    );
    const march = await buildApplyRecurringPlan([yearly], new Map(), 2026, 3, {
      quotes: noQuotes(),
    });

    expect(january.toCreate).toEqual([]);
    expect(march.toCreate.map((item) => item.occurredOn)).toEqual([
      "2026-03-10",
    ]);
  });
});
