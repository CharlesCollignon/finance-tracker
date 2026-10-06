import { describe, expect, it } from "vitest";

import { dcaNeedForMonth, transferCoversMonth } from "./dca-need";
import type { RecurringTemplateWithCategory } from "./types/database";

function template(
  id: string,
  name: string,
  options: Partial<RecurringTemplateWithCategory> & {
    counts?: boolean;
  } = {},
): RecurringTemplateWithCategory {
  const { counts = false, ...rest } = options;
  return {
    id,
    user_id: "u",
    category_id: `cat-${id}`,
    amount: 100,
    day_of_month: 5,
    day_of_week: null,
    month_of_year: null,
    recurrence: "monthly",
    active: true,
    description: null,
    pricing_type: "fixed",
    share_count: null,
    instrument_symbol: null,
    instrument_name: null,
    last_quote_price: null,
    last_quote_at: null,
    starts_on: null,
    ends_on: null,
    property_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...rest,
    categories: {
      name,
      type: "investment",
      icon: null,
      counts_toward_summary: counts,
    },
  };
}

// Three shares of an ETF every Monday at about 110 €, and 400 € into the PEA
// on the 5th.
const cto = template("cto", "DCA CTO", {
  recurrence: "weekly",
  day_of_month: null,
  day_of_week: 1,
  pricing_type: "shares",
  share_count: 3,
  instrument_symbol: "CW8.PA",
  instrument_name: "MSCI World",
  amount: 330,
});
const pea = template("pea", "DCA PEA", { amount: 400 });

describe("dcaNeedForMonth", () => {
  it("adds the month's purchases, with room on the share-priced ones, rounded up", () => {
    // November 2026 has five Mondays: 5 × 330 + 400 = 2 050, and 5 % of the
    // 1 650 bought in shares is 82.50, so 2 132.50 → 2 150.
    const need = dcaNeedForMonth({
      templates: [cto, pea],
      year: 2026,
      month: 11,
    });
    expect(need.count).toBe(6);
    expect(need.cost).toBe(2050);
    expect(need.amount).toBe(2150);
    expect(need.byWallet).toEqual([
      { wallet: "cto", cost: 1650, count: 5 },
      { wallet: "pea", cost: 400, count: 1 },
    ]);
  });

  it("follows the month: four Mondays ask for less", () => {
    // December 2026: 4 × 330 + 400 = 1 720, + 66 = 1 786 → 1 800.
    expect(
      dcaNeedForMonth({ templates: [cto, pea], year: 2026, month: 12 }).amount,
    ).toBe(1800);
  });

  it("puts no margin on a fixed amount, and rounds a round figure as it is", () => {
    const need = dcaNeedForMonth({ templates: [pea], year: 2026, month: 11 });
    expect(need.amount).toBe(400);
  });

  it("leaves out a purchase skipped ahead of time", () => {
    const need = dcaNeedForMonth({
      templates: [cto, pea],
      skippedKeys: new Set(["cto:2026-11-02"]),
      year: 2026,
      month: 11,
    });
    expect(need.count).toBe(5);
    expect(need.cost).toBe(1720);
  });

  it("leaves out a wallet the bank debits, the transfer, and a charge switched off", () => {
    const bitstack = template("bitstack", "DCA Bitstack", {
      recurrence: "weekly",
      day_of_month: null,
      day_of_week: 1,
      amount: 18,
    });
    const transfer = template("transfer", "Virement vers le courtier", {
      counts: true,
      amount: 2000,
    });
    const paused = template("paused", "DCA PEA", { active: false });
    const need = dcaNeedForMonth({
      templates: [pea, bitstack, transfer, paused],
      debited: new Set([bitstack.category_id]),
      year: 2026,
      month: 11,
    });
    expect(need.count).toBe(1);
    expect(need.amount).toBe(400);
  });

  it("is nothing when the month holds no purchase", () => {
    const ended = template("ended", "DCA PEA", { ends_on: "2026-10-31" });
    const need = dcaNeedForMonth({ templates: [ended], year: 2026, month: 11 });
    expect(need).toMatchObject({ cost: 0, amount: 0, count: 0, byWallet: [] });
  });
});

describe("transferCoversMonth", () => {
  const transfer = template("transfer", "Virement vers le courtier", {
    counts: true,
    day_of_month: 28,
  });

  it("covers the month after the transfer still in play", () => {
    // On 6 October the bank could still bring the transfer of 28 September,
    // for October; once it has, the one of 28 October is next, for November.
    expect(transferCoversMonth(transfer, "2026-10-06")).toEqual({
      year: 2026,
      month: 10,
      occurredOn: "2026-09-28",
    });
    expect(
      transferCoversMonth(
        transfer,
        "2026-10-06",
        new Set(["transfer:2026-09-28"]),
      ),
    ).toEqual({ year: 2026, month: 11, occurredOn: "2026-10-28" });
  });

  it("never covers from a transfer before the charge was set up", () => {
    const fresh = { ...transfer, created_at: "2026-10-06T08:00:00Z" };
    expect(transferCoversMonth(fresh, "2026-10-06")).toEqual({
      year: 2026,
      month: 11,
      occurredOn: "2026-10-28",
    });
  });

  it("moves on once the bank could no longer bring it", () => {
    expect(transferCoversMonth(transfer, "2026-11-07")?.month).toBe(11);
    expect(transferCoversMonth(transfer, "2026-11-08")).toEqual({
      year: 2026,
      month: 12,
      occurredOn: "2026-11-28",
    });
  });

  it("turns the year", () => {
    expect(transferCoversMonth(transfer, "2026-12-20")).toEqual({
      year: 2027,
      month: 1,
      occurredOn: "2026-12-28",
    });
  });

  it("has nothing to cover once it has ended, or when it is not monthly", () => {
    expect(
      transferCoversMonth({ ...transfer, ends_on: "2026-09-30" }, "2026-10-20"),
    ).toBeNull();
    expect(
      transferCoversMonth(
        { ...transfer, recurrence: "weekly", day_of_week: 1 },
        "2026-10-06",
      ),
    ).toBeNull();
  });
});
