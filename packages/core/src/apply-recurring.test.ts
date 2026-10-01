import { describe, expect, it } from "vitest";

import {
  buildApplyRecurringPlan,
  calledForKeys,
  countRecurringToApply,
  followTemplateUpdates,
  forecastsNoLongerCalledFor,
  isDue,
  isForecast,
  isPlanned,
  pastOccurrencesNotWritten,
  plannedOccurrences,
  scheduleDatesBefore,
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
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
        locale: "en",
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
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
      { locale: "en", quotes, today: TODAY },
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
    );
    const march = await buildApplyRecurringPlan([yearly], new Map(), 2026, 3, {
      locale: "en",
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
      { locale: "en", quotes: noQuotes(), today: TODAY },
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
      { locale: "en", quotes, today: TODAY },
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
      {
        locale: "en",
        quotes: createFakeQuoteSource({ CW8: 25 }),
        today: TODAY,
      },
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
      {
        locale: "en",
        quotes: createFakeQuoteSource({ CW8: 25 }),
        today: TODAY,
      },
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
      {
        locale: "en",
        quotes: createFakeQuoteSource({ CW8: 25 }),
        today: TODAY,
      },
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
      {
        locale: "en",
        quotes: createFakeQuoteSource({ CW8: 25 }),
        today: TODAY,
      },
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
      locale: "en",
      quotes: noQuotes(),
      today: TODAY,
    });
    const ahead = await buildApplyRecurringPlan(
      [template({ day_of_month: 25 })],
      future,
      2026,
      1,
      { locale: "en", quotes: noQuotes(), today: TODAY },
    );

    expect(settled.toUpdate).toHaveLength(1);
    expect(settled.toReprice).toEqual([]);
    expect(ahead.toUpdate).toHaveLength(1);
    expect(ahead.toReprice).toEqual([]);
  });
});

describe("countRecurringToApply", () => {
  it("counts a monthly template's one unwritten occurrence", () => {
    expect(countRecurringToApply([template()], new Set(), 2026, 1)).toBe(1);
  });

  it("does not count an occurrence already written", () => {
    const written = new Set([recurringOccurrenceKey("tpl-1", "2026-01-15")]);
    expect(countRecurringToApply([template()], written, 2026, 1)).toBe(0);
  });

  it("does not count a skipped occurrence", () => {
    const skipped = new Set([recurringOccurrenceKey("tpl-1", "2026-01-15")]);
    expect(
      countRecurringToApply([template()], new Set(), 2026, 1, skipped),
    ).toBe(0);
  });

  it("ignores an inactive template", () => {
    expect(
      countRecurringToApply([template({ active: false })], new Set(), 2026, 1),
    ).toBe(0);
  });

  it("respects the template's own start and end dates", () => {
    expect(
      countRecurringToApply(
        [template({ starts_on: "2026-02-01" })],
        new Set(),
        2026,
        1,
      ),
    ).toBe(0);
  });

  // The whole reason this exists: the same answer as the plan, for none of
  // the network. A quote source that cannot answer is the case the plan gets
  // *wrong* — it drops the occurrence — so the two are compared against a
  // source that can.
  it("agrees with the plan it saves a round trip to build", async () => {
    const templates = [
      template(),
      sharesTemplate({ id: "tpl-2", day_of_month: 25 }),
    ];
    const plan = await buildApplyRecurringPlan(templates, new Map(), 2026, 1, {
      locale: "en",
      quotes: createFakeQuoteSource({ CW8: 120 }),
      today: TODAY,
    });
    expect(countRecurringToApply(templates, new Set(), 2026, 1)).toBe(
      plan.toCreate.length,
    );
  });

  it("still counts a priced occurrence the market could not answer for", async () => {
    const templates = [sharesTemplate({ day_of_month: 25 })];
    const plan = await buildApplyRecurringPlan(templates, new Map(), 2026, 1, {
      locale: "en",
      quotes: noQuotes(),
      today: TODAY,
    });
    // The plan swallows it; the count does not. A charge is waiting whether
    // or not anyone can price it today.
    expect(plan.toCreate).toHaveLength(0);
    expect(countRecurringToApply(templates, new Set(), 2026, 1)).toBe(1);
  });
});

describe("isForecast", () => {
  it("counts today as still ahead", () => {
    expect(isForecast(TODAY, TODAY)).toBe(true);
    expect(isForecast("2026-01-25", TODAY)).toBe(true);
    expect(isForecast("2026-01-19", TODAY)).toBe(false);
  });
});

describe("calledForKeys", () => {
  it("names every occurrence the month calls for, skips taken out", () => {
    const weekly = template({
      id: "tpl-2",
      recurrence: "weekly",
      day_of_month: null,
      day_of_week: 1,
    });
    const skipped = new Set([recurringOccurrenceKey("tpl-2", "2026-01-05")]);
    const keys = calledForKeys([template(), weekly], 2026, 1, skipped);

    expect(keys.has(recurringOccurrenceKey("tpl-1", "2026-01-15"))).toBe(true);
    expect(keys.has(recurringOccurrenceKey("tpl-2", "2026-01-05"))).toBe(false);
    expect(keys.has(recurringOccurrenceKey("tpl-2", "2026-01-12"))).toBe(true);
  });

  it("calls for nothing from an inactive template", () => {
    expect(calledForKeys([template({ active: false })], 2026, 1).size).toBe(0);
  });
});

describe("followTemplateUpdates", () => {
  const existing = (occurredOn: string, amount: number) =>
    new Map([
      [
        recurringOccurrenceKey("tpl-1", occurredOn),
        { id: `tx-${occurredOn}`, amount, note: "Rent", category_id: "cat-1" },
      ],
    ]);

  it("brings a row still dated ahead in line with the edited template", async () => {
    const plan = await buildApplyRecurringPlan(
      [template({ amount: 50, day_of_month: 25 })],
      existing("2026-01-25", 42),
      2026,
      1,
      { locale: "en", quotes: noQuotes(), today: TODAY },
    );

    expect(followTemplateUpdates(plan, "tpl-1", TODAY)).toMatchObject([
      { transactionId: "tx-2026-01-25", amount: 50, previousAmount: 42 },
    ]);
  });

  it("leaves a row whose date has passed as it was recorded", async () => {
    const plan = await buildApplyRecurringPlan(
      [template({ amount: 50 })],
      existing("2026-01-15", 42),
      2026,
      1,
      { locale: "en", quotes: noQuotes(), today: TODAY },
    );

    expect(plan.toUpdate).toHaveLength(1);
    expect(followTemplateUpdates(plan, "tpl-1", TODAY)).toEqual([]);
  });

  it("only follows the template that was saved", async () => {
    const plan = await buildApplyRecurringPlan(
      [template({ amount: 50, day_of_month: 25 })],
      existing("2026-01-25", 42),
      2026,
      1,
      { locale: "en", quotes: noQuotes(), today: TODAY },
    );

    expect(followTemplateUpdates(plan, "tpl-other", TODAY)).toEqual([]);
  });

  it("carries a quote-priced forecast along with it", async () => {
    const plan = await buildApplyRecurringPlan(
      [sharesTemplate({ day_of_month: 25 })],
      new Map([
        [
          recurringOccurrenceKey("tpl-1", "2026-01-25"),
          { id: "tx-1", amount: 400, note: null, category_id: "cat-1" },
        ],
      ]),
      2026,
      1,
      {
        locale: "en",
        quotes: createFakeQuoteSource({ CW8: 120 }),
        today: TODAY,
      },
    );

    expect(followTemplateUpdates(plan, "tpl-1", TODAY)).toMatchObject([
      { transactionId: "tx-1", amount: 480 },
    ]);
  });
});

describe("forecastsNoLongerCalledFor", () => {
  const row = (id: string, occurredOn: string) => ({
    id,
    templateId: "tpl-1",
    occurredOn,
  });

  it("finds a forecast the template stopped calling for", () => {
    // Moved from the 25th to the 28th: the 25th is not called for any more.
    const calledFor = calledForKeys([template({ day_of_month: 28 })], 2026, 1);
    expect(
      forecastsNoLongerCalledFor(
        [row("tx-25", "2026-01-25")],
        calledFor,
        TODAY,
      ),
    ).toEqual(["tx-25"]);
  });

  it("keeps a forecast the template still calls for", () => {
    const calledFor = calledForKeys([template({ day_of_month: 25 })], 2026, 1);
    expect(
      forecastsNoLongerCalledFor(
        [row("tx-25", "2026-01-25")],
        calledFor,
        TODAY,
      ),
    ).toEqual([]);
  });

  it("never touches a row whose date has passed", () => {
    expect(
      forecastsNoLongerCalledFor(
        [row("tx-15", "2026-01-15")],
        new Set(),
        TODAY,
      ),
    ).toEqual([]);
  });
});

describe("pastOccurrencesNotWritten", () => {
  it("names a past day the new schedule calls for that nothing wrote", () => {
    // Moved from the 25th to the 10th on the 20th: the 10th is behind today.
    expect(
      pastOccurrencesNotWritten(
        [template({ day_of_month: 10 })],
        new Set(),
        2026,
        1,
        new Set(),
        TODAY,
      ),
    ).toEqual([{ templateId: "tpl-1", occurredOn: "2026-01-10" }]);
  });

  it("leaves days still ahead to be filled", () => {
    expect(
      pastOccurrencesNotWritten(
        [template({ day_of_month: 25 })],
        new Set(),
        2026,
        1,
        new Set(),
        TODAY,
      ),
    ).toEqual([]);
  });

  it("passes over a past day already written or already skipped", () => {
    const key = recurringOccurrenceKey("tpl-1", "2026-01-15");
    expect(
      pastOccurrencesNotWritten(
        [template()],
        new Set([key]),
        2026,
        1,
        new Set(),
        TODAY,
      ),
    ).toEqual([]);
    expect(
      pastOccurrencesNotWritten(
        [template()],
        new Set(),
        2026,
        1,
        new Set([key]),
        TODAY,
      ),
    ).toEqual([]);
  });
});

describe("isPlanned", () => {
  it("is only what comes after today", () => {
    expect(isPlanned("2026-01-21", TODAY)).toBe(true);
    expect(isPlanned(TODAY, TODAY)).toBe(false);
  });
});

describe("isDue", () => {
  it("is due once its day has come", () => {
    expect(isDue(template(), "2026-01-15", TODAY)).toBe(true);
    expect(isDue(template(), TODAY, TODAY)).toBe(true);
    expect(isDue(template(), "2026-01-25", TODAY)).toBe(false);
  });

  it("was never due before the template was set up", () => {
    // Set up on the 18th in Paris, whatever the UTC timestamp says.
    const late = template({ created_at: "2026-01-17T23:30:00.000Z" });
    expect(isDue(late, "2026-01-15", TODAY)).toBe(false);
    expect(isDue(late, "2026-01-18", TODAY)).toBe(true);
  });
});

describe("filling only what is due", () => {
  const weekly = template({
    recurrence: "weekly",
    day_of_month: null,
    day_of_week: 1,
  });

  it("counts only the occurrences whose day has come", () => {
    // Mondays in January 2026: 5, 12, 19 are behind the 20th; 26 is not.
    expect(countRecurringToApply([weekly], new Set(), 2026, 1)).toBe(4);
    expect(
      countRecurringToApply([weekly], new Set(), 2026, 1, new Set(), TODAY),
    ).toBe(3);
  });

  it("plans only the due occurrences for creation", async () => {
    const plan = await buildApplyRecurringPlan([weekly], new Map(), 2026, 1, {
      locale: "en",
      quotes: noQuotes(),
      today: TODAY,
      dueBy: TODAY,
    });
    expect(plan.toCreate.map((item) => item.occurredOn)).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
    ]);
  });

  it("still compares a row written ahead against its template", async () => {
    const plan = await buildApplyRecurringPlan(
      [template({ amount: 50, day_of_month: 25 })],
      new Map([
        [
          recurringOccurrenceKey("tpl-1", "2026-01-25"),
          { id: "tx-1", amount: 42, note: "Rent", category_id: "cat-1" },
        ],
      ]),
      2026,
      1,
      { locale: "en", quotes: noQuotes(), today: TODAY, dueBy: TODAY },
    );
    expect(plan.toUpdate).toHaveLength(1);
  });
});

describe("followTemplateUpdates from the first of the month", () => {
  it("reaches this month's recorded row when asked to", async () => {
    const plan = await buildApplyRecurringPlan(
      [template({ amount: 50 })],
      new Map([
        [
          recurringOccurrenceKey("tpl-1", "2026-01-15"),
          { id: "tx-15", amount: 42, note: "Rent", category_id: "cat-1" },
        ],
      ]),
      2026,
      1,
      { locale: "en", quotes: noQuotes(), today: TODAY },
    );
    expect(followTemplateUpdates(plan, "tpl-1", "2026-01-21")).toEqual([]);
    expect(followTemplateUpdates(plan, "tpl-1", "2026-01-01")).toMatchObject([
      { transactionId: "tx-15", amount: 50 },
    ]);
  });
});

describe("forecastsNoLongerCalledFor and today", () => {
  it("keeps today's row: it has been recorded", () => {
    expect(
      forecastsNoLongerCalledFor(
        [{ id: "tx-today", templateId: "tpl-1", occurredOn: TODAY }],
        new Set(),
        TODAY,
      ),
    ).toEqual([]);
  });
});

describe("pastOccurrencesNotWritten and today", () => {
  it("counts today as a day that has come", () => {
    expect(
      pastOccurrencesNotWritten(
        [template({ day_of_month: 20 })],
        new Set(),
        2026,
        1,
        new Set(),
        TODAY,
      ),
    ).toEqual([{ templateId: "tpl-1", occurredOn: "2026-01-20" }]);
  });
});

describe("plannedOccurrences", () => {
  const weekly = template({
    recurrence: "weekly",
    day_of_month: null,
    day_of_week: 1,
  });

  it("draws what is still to come, and nothing else", () => {
    const planned = plannedOccurrences(
      [weekly, template({ id: "tpl-2", day_of_month: 28 })],
      new Set(),
      2026,
      1,
      new Set(),
      TODAY,
    );
    expect(planned.map((item) => item.key)).toEqual([
      recurringOccurrenceKey("tpl-1", "2026-01-26"),
      recurringOccurrenceKey("tpl-2", "2026-01-28"),
    ]);
    expect(planned[0]).toMatchObject({
      name: "Rent",
      amount: 42,
      categoryName: "Housing",
      categoryType: "expense",
    });
  });

  it("leaves out what is written or skipped", () => {
    const key = recurringOccurrenceKey("tpl-1", "2026-01-25");
    const tpl = [template({ day_of_month: 25 })];
    expect(
      plannedOccurrences(tpl, new Set([key]), 2026, 1, new Set(), TODAY),
    ).toEqual([]);
    expect(
      plannedOccurrences(tpl, new Set(), 2026, 1, new Set([key]), TODAY),
    ).toEqual([]);
  });

  it("fills a whole future month", () => {
    expect(
      plannedOccurrences([template()], new Set(), 2026, 3, new Set(), TODAY),
    ).toHaveLength(1);
  });
});

describe("scheduleDatesBefore", () => {
  it("lists this month's days that are already behind today", () => {
    expect(
      scheduleDatesBefore(
        {
          recurrence: "weekly",
          day_of_month: null,
          day_of_week: 1,
          month_of_year: null,
          starts_on: null,
          ends_on: null,
        },
        2026,
        1,
        TODAY,
      ),
    ).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
  });

  it("respects a start date", () => {
    expect(
      scheduleDatesBefore(
        {
          recurrence: "monthly",
          day_of_month: 15,
          day_of_week: null,
          month_of_year: null,
          starts_on: "2026-02-01",
          ends_on: null,
        },
        2026,
        1,
        TODAY,
      ),
    ).toEqual([]);
  });
});
