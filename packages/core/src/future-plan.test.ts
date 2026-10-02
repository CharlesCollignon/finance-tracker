import { describe, expect, it } from "vitest";

import {
  FRENCH_TAX_2026,
  breakdownAccounts,
  breakdownParts,
  buildCushion,
  buildMilestones,
  cushionSavings,
  envelopesFromData,
  milestoneToAnnounce,
  monthlyContributions,
  monthsUntil,
  projectEnvelopes,
  wealthToday,
  withExtraSaving,
  type Envelope,
} from "./future-plan";
import type { ProjectionPoint } from "./projection";
import type {
  CategoryType,
  RecurringTemplateWithCategory,
} from "./types/database";

function template(
  id: string,
  amount: number,
  type: CategoryType,
  name: string,
  { counts = true, active = true }: { counts?: boolean; active?: boolean } = {},
): RecurringTemplateWithCategory {
  return {
    id,
    user_id: "user-1",
    category_id: `cat-${id}`,
    amount,
    day_of_month: 5,
    day_of_week: null,
    month_of_year: null,
    recurrence: "monthly",
    active,
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
    created_at: "2024-01-01T00:00:00.000Z",
    categories: { name, type, icon: null, counts_toward_summary: counts },
  };
}

const MONTH = { year: 2026, month: 10, today: "2026-10-01" };

describe("projectEnvelopes", () => {
  it("compounds monthly and pays in at the end of each month", () => {
    // The reference calculator's case: €10,000, €100 a month, 20 years, 5%.
    const result = projectEnvelopes({
      envelopes: [
        {
          id: "cto",
          initial: 10_000,
          monthly: 100,
          annualReturn: 0.05,
          taxOnGains: 0,
        },
      ],
      years: 20,
      inflation: 0,
      withdrawalRate: 0.04,
    });
    expect(Math.round(result.futureValue)).toBe(67_113);
    expect(result.years).toHaveLength(21);
    expect(result.years[20]!.contributions).toBe(24_000);
    expect(result.monthly).toHaveLength(240);
  });

  it("takes each account's tax on its own gains", () => {
    const result = projectEnvelopes({
      envelopes: [
        {
          id: "pea",
          initial: 10_000,
          monthly: 0,
          annualReturn: 0.07,
          taxOnGains: FRENCH_TAX_2026.socialContributions,
        },
        {
          id: "savings",
          initial: 10_000,
          monthly: 0,
          annualReturn: 0.017,
          taxOnGains: 0,
        },
      ],
      years: 10,
      inflation: 0.02,
      withdrawalRate: 0.04,
    });
    const peaGains = 10_000 * (Math.pow(1.07, 10) - 1);
    expect(result.taxes).toBeCloseTo(peaGains * 0.186, 0);
    expect(result.netValue).toBeCloseTo(result.futureValue - result.taxes, 2);
    expect(result.realNetValue).toBeCloseTo(
      result.netValue / Math.pow(1.02, 10),
      1,
    );
    expect(result.monthlyIncome).toBeCloseTo(
      (result.realNetValue * 0.04) / 12,
      1,
    );
  });

  it("keeps the yearly points adding up", () => {
    const { years } = projectEnvelopes({
      envelopes: [
        {
          id: "av",
          initial: 5_000,
          monthly: 200,
          annualReturn: 0.04,
          taxOnGains: 0.247,
        },
      ],
      years: 5,
      inflation: 0,
      withdrawalRate: 0.04,
    });
    for (const point of years) {
      expect(point.netValue).toBeCloseTo(
        point.initial + point.contributions + point.netGains,
        1,
      );
    }
    expect(years[0]).toEqual({
      year: 0,
      initial: 5000,
      contributions: 0,
      netGains: 0,
      netValue: 5000,
      accounts: [{ id: "av", netValue: 5000 }],
    });
  });
});

describe("envelopesFromData", () => {
  it("fills each account from the user's figures, savings first", () => {
    const envelopes = envelopesFromData({
      wallets: { pea: 12_000, cto: 0, crypto: 800 },
      savingsReserve: 4_500,
      monthly: { pea: 300, savings: 150 },
    });
    expect(envelopes.map((envelope) => envelope.id)).toEqual([
      "savings",
      "pea",
      "crypto",
    ]);
    expect(envelopes[1]).toMatchObject({
      initial: 12_000,
      monthly: 300,
      annualReturn: 0.07,
      taxOnGains: 0.186,
    });
    expect(envelopes[0]).toMatchObject({ annualReturn: 0.017, taxOnGains: 0 });
  });
});

describe("buildMilestones", () => {
  it("keeps the last two passed and the next three, with when", () => {
    const values = Array.from(
      { length: 24 },
      (_, i) => 9_000 + (i + 1) * 1_000,
    );
    expect(buildMilestones(9_000, values)).toEqual([
      { amount: 2_500, reached: true, monthsAway: 0 },
      { amount: 5_000, reached: true, monthsAway: 0 },
      { amount: 10_000, reached: false, monthsAway: 1 },
      { amount: 15_000, reached: false, monthsAway: 6 },
      { amount: 20_000, reached: false, monthsAway: 11 },
    ]);
  });

  it("says when a milestone is out of reach inside the horizon", () => {
    const [, , , last] = buildMilestones(900, [950, 1_000, 1_050]);
    expect(last).toBeUndefined();
    expect(buildMilestones(900, [950, 1_000])[1]).toEqual({
      amount: 2_500,
      reached: false,
      monthsAway: null,
    });
  });
});

describe("buildCushion", () => {
  it("climbs the one, three and six month rungs", () => {
    expect(buildCushion(null)).toMatchObject({ level: 0, nextTarget: 1 });
    expect(buildCushion(0.5)).toMatchObject({ level: 0, nextTarget: 1 });
    expect(buildCushion(2.4)).toMatchObject({
      level: 1,
      nextTarget: 3,
      ratio: 0.4,
    });
    expect(buildCushion(7)).toMatchObject({
      level: 3,
      nextTarget: null,
      ratio: 1,
    });
  });
});

describe("what if", () => {
  const point = (month: number, kept: number) =>
    ({
      monthKey: `2026-${String(month).padStart(2, "0")}`,
      label: `m${month}`,
      kept,
    }) as ProjectionPoint;

  it("adds the extra month after month", () => {
    const points = withExtraSaving(
      [point(10, 1_000), point(11, 1_200), point(12, 1_400)],
      100,
    );
    expect(points.map((p) => p.withExtra)).toEqual([1_100, 1_400, 1_700]);
  });

  it("says how much sooner a milestone arrives", () => {
    const values = [8_000, 8_500, 9_000, 9_500, 10_000];
    expect(monthsUntil(10_000, values)).toBe(5);
    expect(monthsUntil(10_000, values, 500)).toBe(3);
    expect(monthsUntil(50_000, values, 500)).toBeNull();
  });
});

describe("monthlyContributions", () => {
  it("puts savings on the savings accounts and investments where they are named", () => {
    expect(
      monthlyContributions({
        templates: [
          template("épargne", 200, "savings", "Épargne"),
          template("pea", 300, "investment", "Virement PEA"),
          template("rent", 900, "expense", "Loyer"),
          template("old", 50, "savings", "Épargne", { active: false }),
        ],
        wallets: {},
        templateWallets: {},
        ...MONTH,
      }),
    ).toEqual({ savings: 200, pea: 300 });
  });

  it("counts the purchases inside an account rather than the transfer that paid for them", () => {
    expect(
      monthlyContributions({
        templates: [
          template("transfer", 500, "investment", "Virement PEA"),
          template("etf", 450, "investment", "ETF World", { counts: false }),
        ],
        wallets: {},
        templateWallets: { etf: "pea" },
        ...MONTH,
      }),
    ).toEqual({ pea: 450 });
  });

  it("puts a transfer that names no account on the largest one, only when nothing else is placed", () => {
    const transfer = template("broker", 400, "investment", "Courtier");
    expect(
      monthlyContributions({
        templates: [transfer],
        wallets: { pea: 2_000, av: 8_000 },
        templateWallets: {},
        ...MONTH,
      }),
    ).toEqual({ av: 400 });
    expect(
      monthlyContributions({
        templates: [transfer],
        wallets: {},
        templateWallets: {},
        ...MONTH,
      }),
    ).toEqual({ cto: 400 });
    expect(
      monthlyContributions({
        templates: [transfer, template("pea", 100, "investment", "PEA")],
        wallets: { av: 8_000 },
        templateWallets: {},
        ...MONTH,
      }),
    ).toEqual({ pea: 100 });
  });
});

describe("savings accounts in the long view", () => {
  it("lists each declared account and sends savings to its own category", () => {
    const monthly = monthlyContributions({
      templates: [
        template("ldds", 100, "savings", "LDDS"),
        template("generic", 200, "savings", "Épargne"),
      ],
      wallets: {},
      templateWallets: {},
      savingsCategories: { "cat-ldds": "ldds" },
      defaultSavings: "livret_a",
      ...MONTH,
    });
    expect(monthly).toEqual({ ldds: 100, livret_a: 200 });

    const envelopes = envelopesFromData({
      wallets: { pea: 10_000 },
      savingsAccounts: [
        { kind: "pel", balance: 20_000, rate: 0.025 },
        { kind: "livret_a", balance: 5_000, rate: 0.017 },
        { kind: "ldds", balance: 0, rate: 0.017 },
      ],
      savingsReserve: 99_999,
      monthly,
    });
    expect(envelopes.map((envelope) => envelope.id)).toEqual([
      "livret_a",
      "ldds",
      "pel",
      "pea",
    ]);
    expect(envelopes.find((envelope) => envelope.id === "pel")).toMatchObject({
      initial: 20_000,
      annualReturn: 0.025,
      taxOnGains: 0.3,
    });
  });

  it("stops paying into a full account and breaks the future down by account", () => {
    const result = projectEnvelopes({
      envelopes: [
        {
          id: "ldds",
          initial: 11_900,
          monthly: 100,
          annualReturn: 0,
          taxOnGains: 0,
        },
        {
          id: "cto",
          initial: 1_000,
          monthly: 0,
          annualReturn: 0,
          taxOnGains: 0,
        },
      ],
      years: 1,
      inflation: 0,
      withdrawalRate: 0.04,
    });
    expect(result.accounts).toEqual([
      { id: "ldds", netValue: 12_000 },
      { id: "cto", netValue: 1_000 },
    ]);
    expect(result.years[1].accounts).toEqual(result.accounts);
  });
});

describe("cushionSavings", () => {
  it("counts the savings at hand and leaves a PEL and the wallets out", () => {
    const base = { monthly: 0, annualReturn: 0, taxOnGains: 0 };
    expect(
      cushionSavings([
        { id: "livret_a", initial: 3_000, ...base },
        { id: "pel", initial: 20_000, ...base },
        { id: "pea", initial: 9_000, ...base },
      ]),
    ).toBe(3_000);
    expect(cushionSavings([{ id: "savings", initial: 4_500, ...base }])).toBe(
      4_500,
    );
  });
});

describe("the breakdown by account", () => {
  it("names the largest at the horizon and keeps their places in any year", () => {
    const horizon = [
      { id: "livret_a" as const, netValue: 30_000 },
      { id: "pel" as const, netValue: 1_000 },
      { id: "pea" as const, netValue: 90_000 },
      { id: "cto" as const, netValue: 20_000 },
      { id: "crypto" as const, netValue: 5_000 },
    ];
    const named = breakdownAccounts(horizon);
    expect(named).toEqual(["livret_a", "pea", "cto", "crypto"]);

    // Earlier on, the Livret A is the largest: the places do not move.
    expect(
      breakdownParts(
        [
          { id: "livret_a", netValue: 9_000 },
          { id: "pel", netValue: 800 },
          { id: "pea", netValue: 4_000 },
          { id: "cto", netValue: 0 },
          { id: "crypto", netValue: 500 },
        ],
        named,
      ),
    ).toEqual([
      { id: "livret_a", netValue: 9_000, slot: 0 },
      { id: "pea", netValue: 4_000, slot: 1 },
      { id: "crypto", netValue: 500, slot: 3 },
      { id: "others", netValue: 800, slot: null },
    ]);
  });
});

describe("milestoneToAnnounce", () => {
  it("announces nothing before the first celebration", () => {
    expect(milestoneToAnnounce(12_000, null)).toBeNull();
  });

  it("announces the highest tier passed since the last one seen", () => {
    expect(milestoneToAnnounce(26_000, 10_000)).toBe(25_000);
    expect(milestoneToAnnounce(14_000, 10_000)).toBeNull();
    expect(milestoneToAnnounce(9_000, 10_000)).toBeNull();
  });
});

describe("wealthToday", () => {
  it("adds every account's opening amount", () => {
    expect(
      wealthToday([{ initial: 1_000 }, { initial: 2_500 }] as Envelope[]),
    ).toBe(3_500);
  });
});
