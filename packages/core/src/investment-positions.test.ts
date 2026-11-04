import { describe, expect, it } from "vitest";

import {
  buildInvestmentPortfolio,
  sortPositions,
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

function row(
  partial: Partial<InvestmentPositionRow> = {},
): InvestmentPositionRow {
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
    "en",
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
      row({
        instrument_symbol: "SWDA.AS",
        share_count: 100,
        value_pinned: true,
      }),
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

describe("sortPositions", () => {
  const rows = [
    { name: "NVIDIA", totalInvested: 2000 },
    { name: "amundi msci world", totalInvested: 500 },
    { name: "Élan Europe", totalInvested: 900 },
    { name: "Bitcoin", totalInvested: 900 },
  ];

  it("orders by name, ignoring case and accents", () => {
    expect(sortPositions(rows, "name").map((row) => row.name)).toEqual([
      "amundi msci world",
      "Bitcoin",
      "Élan Europe",
      "NVIDIA",
    ]);
  });

  it("orders by what was put in, largest first", () => {
    expect(
      sortPositions(rows, "invested").map((row) => row.totalInvested),
    ).toEqual([2000, 900, 900, 500]);
  });

  it("settles an equal amount by name, so the order never wobbles", () => {
    expect(sortPositions(rows, "invested").map((row) => row.name)).toEqual([
      "NVIDIA",
      "Bitcoin",
      "Élan Europe",
      "amundi msci world",
    ]);
  });

  it("leaves the caller's own array alone", () => {
    const original = [...rows];
    sortPositions(rows, "name");
    expect(rows).toEqual(original);
  });
});

/**
 * « C'est passé » used to reach the ledger and never Placements: the typed
 * « Total versé » and shares stayed as typed whatever was bought after.
 * Purchases made after the day they were typed (`balance_as_of`) now add.
 */
describe("purchases after the figures were typed", () => {
  const PEA = "cat-pea";
  const BITSTACK = "cat-bitstack";
  const categories = [
    {
      id: PEA,
      name: "PEA",
      type: "investment",
      icon: null,
      counts_toward_summary: false,
    },
    {
      id: BITSTACK,
      name: "Bitstack",
      type: "investment",
      icon: null,
      counts_toward_summary: false,
    },
  ] as unknown as Category[];

  const dca = {
    id: "tpl-dca",
    category_id: PEA,
    pricing_type: "shares",
    share_count: 2,
    instrument_symbol: "CW8.PA",
    instrument_name: "MSCI World",
    categories: {
      name: "PEA",
      type: "investment",
      icon: null,
      counts_toward_summary: false,
    },
  } as unknown as RecurringTemplateWithCategory;

  function buy(
    occurredOn: string,
    amount: number,
    templateId: string | null = "tpl-dca",
    categoryId = PEA,
  ): TransactionWithCategory {
    return {
      id: `tx-${occurredOn}-${amount}`,
      occurred_on: occurredOn,
      amount,
      category_id: categoryId,
      recurring_template_id: templateId,
    } as unknown as TransactionWithCategory;
  }

  function build(
    rows: InvestmentPositionRow[],
    transactions: TransactionWithCategory[],
    quotes: Record<string, number>,
    history: Record<string, Record<string, number>> = {},
  ) {
    return buildInvestmentPortfolio(
      categories,
      transactions,
      rows,
      [dca],
      quotes,
      "fr",
      TODAY,
      history,
    ).columns.flatMap((column) => column.items);
  }

  const pea = row({
    id: "pos-pea",
    wallet: "pea",
    recurring_template_id: "tpl-dca",
    category_id: PEA,
    initial_balance: 5000,
    share_count: 10,
    instrument_symbol: "CW8.PA",
    balance_as_of: "2026-09-04",
  });

  it("adds what was bought after the day, not on or before it", () => {
    const [item] = build(
      [pea],
      [
        buy("2026-09-01", 1000),
        buy("2026-09-04", 1000),
        buy("2026-09-08", 1020),
      ],
      { "CW8.PA": 510 },
    );
    expect(item!.totalInvested).toBe(6020);
    expect(item!.shareCount).toBe(12);
    expect(item!.marketValue).toBe(6120);
  });

  it("counts nothing ahead of today, and nothing at all before 083", () => {
    const [ahead] = build([pea], [buy("2026-09-20", 1000)], { "CW8.PA": 510 });
    expect(ahead!.totalInvested).toBe(5000);
    const [before] = build(
      [{ ...pea, balance_as_of: null }],
      [buy("2026-09-08", 1020)],
      { "CW8.PA": 510 },
    );
    expect(before!.totalInvested).toBe(5000);
    expect(before!.shareCount).toBe(10);
  });

  it("carries a typed value forward by what was bought since", () => {
    const [item] = build(
      [{ ...pea, current_value: 5600, value_pinned: true }],
      [buy("2026-09-08", 1020)],
      {},
    );
    expect(item!.valuationSource).toBe("pinned");
    expect(item!.marketValue).toBe(6620);
    expect(item!.currentValue).toBe(6620);
  });

  it("gives a Bitstack debit to the one position of its wallet, its BTC from the month's close", () => {
    const bitstack = row({
      id: "pos-btc",
      wallet: "crypto",
      category_id: BITSTACK,
      initial_balance: 800,
      share_count: 0.01,
      instrument_symbol: "BTC-EUR",
      balance_as_of: "2026-09-04",
    });
    const [item] = build(
      [bitstack],
      [
        buy("2026-09-08", 20, null, BITSTACK),
        buy("2026-09-10", 20, null, BITSTACK),
      ],
      { "BTC-EUR": 100000 },
      { "BTC-EUR": { "2026-09": 80000 } },
    );
    expect(item!.totalInvested).toBe(840);
    expect(item!.shareCount).toBe(0.0105);
    expect(item!.marketValue).toBe(1050);
  });

  it("adds at cost what no price can turn into shares", () => {
    const bitstack = row({
      id: "pos-btc",
      wallet: "crypto",
      category_id: BITSTACK,
      initial_balance: 800,
      share_count: 0.01,
      instrument_symbol: "BTC-EUR",
      balance_as_of: "2026-09-04",
    });
    const [item] = build([bitstack], [buy("2026-09-08", 20, null, BITSTACK)], {
      "BTC-EUR": 100000,
    });
    expect(item!.shareCount).toBe(0.01);
    expect(item!.marketValue).toBe(1020);
  });

  it("guesses nothing between two lines of one wallet", () => {
    const other = row({
      id: "pos-other",
      wallet: "pea",
      category_id: PEA,
      initial_balance: 300,
      balance_as_of: "2026-09-04",
    });
    const items = build(
      [pea, other],
      [buy("2026-09-08", 50, null, PEA), buy("2026-09-08", 1020)],
      { "CW8.PA": 510 },
    );
    expect(items.find((item) => item.id === "pos-pea")!.totalInvested).toBe(
      6020,
    );
    expect(items.find((item) => item.id === "pos-other")!.totalInvested).toBe(
      300,
    );
  });

  it("ends the chart on the card's own total", () => {
    const [item] = build([pea], [buy("2026-09-08", 1020)], { "CW8.PA": 510 });
    expect(item!.chartPoints.at(-1)!.invested).toBe(6020);
  });
});
