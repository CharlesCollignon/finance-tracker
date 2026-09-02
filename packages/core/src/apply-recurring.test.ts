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

/** Fixed "today" so past and future occurrences are not a matter of when the
 *  suite runs. The 15th of the month is behind it; the 25th is ahead. */
const TODAY = "2026-01-20";

function sharesTemplate(
  overrides: Partial<RecurringTemplateWithCategory> = {},
): RecurringTemplateWithCategory {
  return template({
    pricing_type: "shares",
    amount: 0,
    share_count: 4,
    instrument_symbol: "CW8",
    instrument_name: "Amundi MSCI World",
    description: null,
    ...overrides,
  });
}

describe("buildApplyRecurringPlan", () => {
  it("plans one occurrence for a monthly template", async () => {
    const plan = await buildApplyRecurringPlan(
      [template()],
      new Map(),
      2026,
      1,
      { quotes: noQuotes(), today: TODAY },
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
      { quotes: noQuotes(), today: TODAY },
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
        today: TODAY,
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
        today: TODAY,
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
        today: TODAY,
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
        today: TODAY,
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
      { quotes: noQuotes(), today: TODAY },
    );

    expect(plan.toCreate).toEqual([]);
  });

  it("prices a share-based template from the quote source", async () => {
    const quotes = createFakeQuoteSource({ CW8: 25 });
    const plan = await buildApplyRecurringPlan(
      [sharesTemplate()],
      new Map(),
      2026,
      1,
      { quotes, today: TODAY },
    );

    expect(quotes.calls).toEqual(["CW8"]);
    expect(plan.toCreate[0]).toMatchObject({
      amount: 100,
      name: "Amundi MSCI World",
      pricedFromQuote: true,
    });
  });

  it("drops an occurrence it cannot price at all", async () => {
    const plan = await buildApplyRecurringPlan(
      [sharesTemplate({ instrument_name: null, last_quote_price: null })],
      new Map(),
      2026,
      1,
      { quotes: noQuotes(), today: TODAY },
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
      { quotes: noQuotes(), today: TODAY },
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
        today: TODAY,
      },
    );
    const march = await buildApplyRecurringPlan([yearly], new Map(), 2026, 3, {
      quotes: noQuotes(),
      today: TODAY,
    });

    expect(january.toCreate).toEqual([]);
    expect(march.toCreate.map((item) => item.occurredOn)).toEqual([
      "2026-03-10",
    ]);
  });

  it("marks a fixed template's occurrences as not quote-priced", async () => {
    const plan = await buildApplyRecurringPlan(
      [template()],
      new Map(),
      2026,
      1,
      { quotes: noQuotes(), today: TODAY },
    );

    expect(plan.toCreate[0]?.pricedFromQuote).toBe(false);
  });

  it("treats a share count with no instrument as a fixed amount", async () => {
    const quotes = createFakeQuoteSource({ CW8: 25 });
    const plan = await buildApplyRecurringPlan(
      [sharesTemplate({ amount: 42, instrument_symbol: null })],
      new Map(),
      2026,
      1,
      { quotes, today: TODAY },
    );

    expect(quotes.calls).toEqual([]);
    expect(plan.toCreate[0]).toMatchObject({
      amount: 42,
      pricedFromQuote: false,
    });
  });

  it("leaves a settled quote-priced occurrence alone when the price moved", async () => {
    const existing = new Map([
      [
        recurringOccurrenceKey("tpl-1", "2026-01-15"),
        { id: "tx-1", amount: 92, note: "stale note", category_id: "cat-1" },
      ],
    ]);

    const plan = await buildApplyRecurringPlan(
      [sharesTemplate()],
      existing,
      2026,
      1,
      { quotes: createFakeQuoteSource({ CW8: 25 }), today: TODAY },
    );

    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toReprice).toEqual([]);
  });

  it("reprices a quote-priced occurrence that has not happened yet", async () => {
    const existing = new Map([
      [
        recurringOccurrenceKey("tpl-1", "2026-01-25"),
        { id: "tx-1", amount: 92, note: "stale note", category_id: "cat-1" },
      ],
    ]);

    const plan = await buildApplyRecurringPlan(
      [sharesTemplate({ day_of_month: 25 })],
      existing,
      2026,
      1,
      { quotes: createFakeQuoteSource({ CW8: 25 }), today: TODAY },
    );

    expect(plan.toUpdate).toEqual([]);
    expect(plan.toReprice).toHaveLength(1);
    expect(plan.toReprice[0]).toMatchObject({
      transactionId: "tx-1",
      amount: 100,
      previousAmount: 92,
      previousNote: "stale note",
    });
  });

  it("reprices an occurrence falling on today", async () => {
    const existing = new Map([
      [
        recurringOccurrenceKey("tpl-1", TODAY),
        { id: "tx-1", amount: 92, note: "stale note", category_id: "cat-1" },
      ],
    ]);

    const plan = await buildApplyRecurringPlan(
      [sharesTemplate({ day_of_month: 20 })],
      existing,
      2026,
      1,
      { quotes: createFakeQuoteSource({ CW8: 25 }), today: TODAY },
    );

    expect(plan.toReprice).toHaveLength(1);
    expect(plan.toReprice[0]).toMatchObject({ amount: 100 });
  });

  it("asks about a reclassified settled occurrence without repricing it", async () => {
    const existing = new Map([
      [
        recurringOccurrenceKey("tpl-1", "2026-01-15"),
        {
          id: "tx-1",
          amount: 92,
          note: "bought at 23",
          category_id: "cat-old",
        },
      ],
    ]);

    const plan = await buildApplyRecurringPlan(
      [sharesTemplate()],
      existing,
      2026,
      1,
      { quotes: createFakeQuoteSource({ CW8: 25 }), today: TODAY },
    );

    expect(plan.toReprice).toEqual([]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0]).toMatchObject({
      transactionId: "tx-1",
      categoryId: "cat-1",
      previousCategoryId: "cat-old",
      // The figure and note it was bought at are left exactly as they are.
      amount: 92,
      note: "bought at 23",
    });
  });

  it("still asks about a fixed amount the user changed, past or future", async () => {
    const past = new Map([
      [
        recurringOccurrenceKey("tpl-1", "2026-01-15"),
        { id: "tx-1", amount: 30, note: "Rent", category_id: "cat-1" },
      ],
    ]);
    const future = new Map([
      [
        recurringOccurrenceKey("tpl-1", "2026-01-25"),
        { id: "tx-2", amount: 30, note: "Rent", category_id: "cat-1" },
      ],
    ]);

    const settled = await buildApplyRecurringPlan([template()], past, 2026, 1, {
      quotes: noQuotes(),
      today: TODAY,
    });
    const ahead = await buildApplyRecurringPlan(
      [template({ day_of_month: 25 })],
      future,
      2026,
      1,
      { quotes: noQuotes(), today: TODAY },
    );

    expect(settled.toUpdate).toHaveLength(1);
    expect(settled.toReprice).toEqual([]);
    expect(ahead.toUpdate).toHaveLength(1);
    expect(ahead.toReprice).toEqual([]);
  });
});
