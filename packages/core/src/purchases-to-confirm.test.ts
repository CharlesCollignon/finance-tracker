import { describe, expect, it } from "vitest";

import { purchasesToConfirm } from "./purchases-to-confirm";
import { buildStillToCome } from "./still-to-come";
import {
  bankForecast,
  debitedPurchaseForecast,
  fulfilmentOccurrences,
} from "./recurring-fulfilment";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
} from "./types/database";

function template(
  id: string,
  day: number,
  type: CategoryType,
  options: {
    counts?: boolean;
    active?: boolean;
    createdAt?: string;
    description?: string;
  } = {},
): RecurringTemplateWithCategory {
  return {
    id,
    user_id: "u",
    category_id: `cat-${id}`,
    amount: 200,
    day_of_month: day,
    day_of_week: null,
    month_of_year: null,
    recurrence: "monthly",
    active: options.active ?? true,
    description: options.description ?? null,
    pricing_type: "fixed",
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    last_quote_price: null,
    last_quote_at: null,
    starts_on: null,
    ends_on: null,
    property_id: null,
    created_at: options.createdAt ?? "2026-01-01T00:00:00Z",
    categories: {
      name: id,
      type,
      icon: null,
      counts_toward_summary: options.counts ?? true,
    },
  };
}

// A DCA into the PEA on the 5th, and the transfer that funds it.
const dca = template("dca", 5, "investment", {
  counts: false,
  description: "DCA PEA",
});
const transfer = template("transfer", 2, "investment");

const ask = (
  today: string,
  templates = [dca, transfer],
  writtenKeys = new Set<string>(),
  settledKeys = new Set<string>(),
) => purchasesToConfirm({ templates, writtenKeys, settledKeys, today });

describe("purchasesToConfirm", () => {
  it("asks about a purchase inside a wallet once its day has come", () => {
    expect(ask("2026-10-04")).toEqual([]);
    expect(ask("2026-10-05")).toEqual([
      {
        key: "dca:2026-10-05",
        templateId: "dca",
        occurredOn: "2026-10-05",
        label: "DCA PEA",
        amount: 200,
      },
    ]);
  });

  it("never asks about what the bank can see", () => {
    expect(ask("2026-10-06").map((item) => item.templateId)).toEqual(["dca"]);
  });

  it("stops asking ten days after its day, and reaches into last month", () => {
    expect(ask("2026-10-15")).toHaveLength(1);
    expect(ask("2026-10-16")).toEqual([]);

    const late = template("late", 28, "investment", { counts: false });
    expect(ask("2026-10-03", [late]).map((item) => item.key)).toEqual([
      "late:2026-09-28",
    ]);
  });

  it("leaves out one already written, skipped or confirmed", () => {
    const key = "dca:2026-10-05";
    expect(ask("2026-10-06", [dca], new Set([key]))).toEqual([]);
    expect(ask("2026-10-06", [dca], new Set(), new Set([key]))).toEqual([]);
  });

  it("never asks about one from before the charge was set up", () => {
    const fresh = template("fresh", 5, "investment", {
      counts: false,
      createdAt: "2026-10-06T08:00:00Z",
    });
    expect(ask("2026-10-06", [fresh])).toEqual([]);
  });

  it("skips a charge that is switched off", () => {
    const off = template("off", 5, "investment", {
      counts: false,
      active: false,
    });
    expect(ask("2026-10-06", [off])).toEqual([]);
  });
});

describe("a purchase inside a wallet and the bank", () => {
  it("is never awaited from the bank", () => {
    const templates = [dca, transfer];
    const occurrences = fulfilmentOccurrences(
      templates,
      templates.map((t) => ({
        id: t.category_id,
        type: t.categories.type,
        name: t.categories.name,
      })),
      [{ year: 2026, month: 10 }],
    );
    const forecast = bankForecast(templates, occurrences, [], "2026-10-06");
    expect([...forecast.awaited]).toEqual(["transfer:2026-10-02"]);
  });
});

describe("a wallet the bank debits", () => {
  // Bitstack: about 18 € every Monday, taken from the account by card as a
  // round-up and the week's buy, whatever they came to.
  const bitstack: RecurringTemplateWithCategory = {
    ...template("bitstack", 0, "investment", {
      counts: false,
      description: "DCA Bitstack",
    }),
    amount: 18,
    recurrence: "weekly",
    day_of_month: null,
    day_of_week: 1,
  };
  const debited = new Set([bitstack.category_id]);
  const october = [{ year: 2026, month: 10 }];
  const debit = (occurredOn: string, categoryId = bitstack.category_id) => ({
    occurredOn,
    categoryId,
  });

  it("is settled by its debits, whatever they came to", () => {
    // Monday the 5th: 9.62 € and 5.10 €, nowhere near 18 €.
    const forecast = debitedPurchaseForecast(
      [bitstack],
      debited,
      october,
      [debit("2026-10-05"), debit("2026-10-05")],
      "2026-10-06",
    );
    expect([...forecast.arrived]).toEqual(["bitstack:2026-10-05"]);
    expect([...forecast.awaited]).toEqual([]);
  });

  it("is awaited until a debit comes", () => {
    const forecast = debitedPurchaseForecast(
      [bitstack],
      debited,
      october,
      [debit("2026-10-05", "cat-elsewhere")],
      "2026-10-06",
    );
    expect([...forecast.arrived]).toEqual([]);
    expect([...forecast.awaited]).toEqual(["bitstack:2026-10-05"]);
  });

  it("gives a debit to the Monday it is nearest", () => {
    // A Thursday is inside both Mondays' room; the earlier one is nearer.
    const forecast = debitedPurchaseForecast(
      [bitstack],
      debited,
      october,
      [debit("2026-10-08")],
      "2026-10-08",
    );
    expect([...forecast.arrived]).toEqual(["bitstack:2026-10-05"]);
  });

  it("is never asked about", () => {
    expect(
      purchasesToConfirm({
        templates: [bitstack],
        writtenKeys: new Set(),
        settledKeys: new Set(),
        debited,
        today: "2026-10-06",
      }),
    ).toEqual([]);
  });

  it("takes the balance down while it is still to come", () => {
    const still = buildStillToCome(
      [],
      [bitstack],
      2026,
      10,
      "2026-10-06",
      new Set(),
      new Set(),
      {
        awaited: new Set(),
        arrived: new Set(),
        debited,
      },
    );
    // The 12th, the 19th and the 26th.
    expect(still.outgoing.map((charge) => charge.tracked ?? false)).toEqual([
      false,
      false,
      false,
    ]);

    // A DCA PEA, bought with money already at the broker, still does not.
    const pea = buildStillToCome([], [dca], 2026, 10, "2026-10-01");
    expect(pea.outgoing[0]?.tracked).toBe(true);
  });
});
