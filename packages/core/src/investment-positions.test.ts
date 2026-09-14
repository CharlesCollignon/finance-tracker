import { describe, expect, it } from "vitest";

import {
  buildInvestmentPortfolio,
  type InvestmentPositionItem,
  type InvestmentPositionRow,
} from "./investment-positions";
import { investmentPositionSchema } from "./validations/investments";
import type {
  Category,
  RecurringTemplateWithCategory,
  TransactionWithCategory,
} from "./types/database";

const TODAY = "2026-09-14";

/**
 * How a holding gets its value.
 *
 * This is the app's oldest piece of load-bearing arithmetic and it had no test
 * of its own until the precedence changed. Four answers, in order: a figure
 * the user pinned, the market, a figure they typed that no quote could
 * replace, and what it cost. Getting the order wrong is not a visual bug — it
 * is a wrong number on the dashboard, stated with the same confidence as a
 * right one.
 */

function row(partial: Partial<InvestmentPositionRow> = {}): InvestmentPositionRow {
  return {
    id: "pos-1",
    wallet: "cto",
    recurring_template_id: null,
    name: "World tracker",
    category_id: null,
    initial_balance: 10000,
    current_value: null,
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    ongoing_charge: null,
    ...partial,
  };
}

/** One position through the real builder, as the app sees it. */
function value(
  positionRow: InvestmentPositionRow,
  liveQuotes: Record<string, number> = {},
): InvestmentPositionItem {
  const categories: Category[] = [];
  const transactions: TransactionWithCategory[] = [];
  const templates: RecurringTemplateWithCategory[] = [];

  const portfolio = buildInvestmentPortfolio(
    categories,
    transactions,
    [positionRow],
    templates,
    liveQuotes,
    TODAY,
  );

  const item = portfolio.columns
    .flatMap((column) => column.items)
    .find((candidate) => candidate.id === positionRow.id);

  if (!item) {
    throw new Error("the builder dropped the position");
  }
  return item;
}

describe("valuation precedence", () => {
  it("values from the market when there is a quote and a share count", () => {
    const item = value(
      row({ instrument_symbol: "SWDA.AS", share_count: 100 }),
      { "SWDA.AS": 112.5 },
    );

    expect(item.valuationSource).toBe("live");
    expect(item.marketValue).toBe(11250);
    expect(item.gainLoss).toBe(1250);
  });

  /**
   * The reported bug, as a test.
   *
   * A figure typed off a broker statement used to outrank the market forever.
   * Now it is a fallback, and the market moves the dashboard.
   */
  it("prefers the market over a figure that was merely typed", () => {
    const item = value(
      row({
        instrument_symbol: "SWDA.AS",
        share_count: 100,
        current_value: 9000,
      }),
      { "SWDA.AS": 112.5 },
    );

    expect(item.valuationSource).toBe("live");
    expect(item.marketValue).toBe(11250);
  });

  it("uses the typed figure when it has been pinned", () => {
    const item = value(
      row({
        instrument_symbol: "SWDA.AS",
        share_count: 100,
        current_value: 9000,
        value_pinned: true,
      }),
      { "SWDA.AS": 112.5 },
    );

    expect(item.valuationSource).toBe("pinned");
    expect(item.marketValue).toBe(9000);
  });

  it("falls back to the typed figure when no quote can be had", () => {
    const item = value(row({ current_value: 9000 }));

    expect(item.valuationSource).toBe("manual");
    expect(item.marketValue).toBe(9000);
  });

  it("falls back to the typed figure when shares are unknown", () => {
    // A quote is useless without a share count, so the figure survives.
    const item = value(
      row({ instrument_symbol: "SWDA.AS", current_value: 9000 }),
      { "SWDA.AS": 112.5 },
    );

    expect(item.valuationSource).toBe("manual");
    expect(item.marketValue).toBe(9000);
  });

  it("falls back to what it cost when nothing else is known", () => {
    const item = value(row());

    expect(item.valuationSource).toBe("cost-basis");
    expect(item.marketValue).toBe(10000);
    // Cost basis means no gain can be claimed, which is the honest answer
    // rather than zero growth being presented as a measurement.
    expect(item.gainLoss).toBe(0);
  });

  /**
   * The same bug, from the other direction.
   *
   * The web form maps 0 to null before saving, but the phone writes the field
   * straight through and rows predating the fix still hold zeros — so the
   * guard has to be here, where both clients pass.
   */
  it("treats a stored zero as no override, whatever wrote it", () => {
    const item = value(
      row({
        instrument_symbol: "SWDA.AS",
        share_count: 100,
        current_value: 0,
      }),
      { "SWDA.AS": 112.5 },
    );

    expect(item.valuationSource).toBe("live");
    expect(item.marketValue).toBe(11250);
    expect(item.hasManualValue).toBe(false);
  });

  it("falls back to cost basis for a stored zero with no quote", () => {
    // Not zero: a holding that cost 10,000 and cannot be priced is worth
    // 10,000 as far as anything honest can say.
    const item = value(row({ current_value: 0 }));
    expect(item.valuationSource).toBe("cost-basis");
    expect(item.marketValue).toBe(10000);
  });

  it("ignores a pin with no figure behind it", () => {
    const item = value(
      row({ instrument_symbol: "SWDA.AS", share_count: 100, value_pinned: true }),
      { "SWDA.AS": 112.5 },
    );

    // Pinning nothing cannot mean "worth nothing".
    expect(item.valuationSource).toBe("live");
    expect(item.marketValue).toBe(11250);
  });

  it("treats a missing pin flag as unpinned", () => {
    // Rows selected by the phone's narrower queries carry no `value_pinned`.
    const item = value(
      row({
        instrument_symbol: "SWDA.AS",
        share_count: 100,
        current_value: 9000,
        value_pinned: undefined,
      }),
      { "SWDA.AS": 112.5 },
    );
    expect(item.valuationSource).toBe("live");
  });
});

describe("needsShareCount", () => {
  it("asks for shares when an instrument has no quotable count", () => {
    const item = value(row({ instrument_symbol: "SWDA.AS" }));
    expect(item.needsShareCount).toBe(true);
  });

  it("stops asking once the market can be used", () => {
    const item = value(
      row({ instrument_symbol: "SWDA.AS", share_count: 100 }),
      { "SWDA.AS": 112.5 },
    );
    expect(item.needsShareCount).toBe(false);
  });

  /** A pinned position's figure *is* the answer, so shares are moot. */
  it("stops asking for a pinned position", () => {
    const item = value(
      row({
        instrument_symbol: "SWDA.AS",
        current_value: 9000,
        value_pinned: true,
      }),
    );
    expect(item.needsShareCount).toBe(false);
  });

  it("never asks a position with no instrument", () => {
    const item = value(row({ current_value: 9000 }));
    expect(item.needsShareCount).toBe(false);
  });
});

describe("investmentPositionSchema and the broker figure", () => {
  function parse(overrides: Record<string, unknown> = {}) {
    return investmentPositionSchema.safeParse({
      wallet: "cto",
      sourceType: "custom",
      name: "World tracker",
      initialBalance: "10000",
      ...overrides,
    });
  }

  /**
   * The bug this whole change exists to fix.
   *
   * Typing 0 into a field labelled "usually leave empty" means "I have no
   * override". Read literally it valued the holding at zero euros, and a real
   * position vanished from the dashboard.
   */
  it("reads 0 as no override rather than as nothing", () => {
    const parsed = parse({ currentValue: "0" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.currentValue).toBeNull();
  });

  it("reads an empty field the same way", () => {
    const parsed = parse({ currentValue: "" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.currentValue).toBeNull();
  });

  it("keeps a real figure", () => {
    const parsed = parse({ currentValue: "9000" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.currentValue).toBe(9000);
  });

  it("refuses a negative figure", () => {
    expect(parse({ currentValue: "-5" }).success).toBe(false);
  });

  it("reads a checked box as pinned", () => {
    const parsed = parse({ currentValue: "9000", valuePinned: "on" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.valuePinned).toBe(true);
  });

  it("reads an absent box as unpinned, so the market wins by default", () => {
    const parsed = parse({ currentValue: "9000" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.valuePinned).toBe(false);
  });

  it("drops a pin that has no figure to pin", () => {
    const parsed = parse({ currentValue: "0", valuePinned: "on" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.currentValue).toBeNull();
    expect(parsed.data.valuePinned).toBe(false);
  });
});
