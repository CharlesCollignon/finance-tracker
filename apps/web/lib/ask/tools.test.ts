import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ask = vi.hoisted(() => ({
  readLedgerRows: vi.fn(),
  readMonthlyFlows: vi.fn(),
  readSpendingByMonth: vi.fn(),
}));
const properties = vi.hoisted(() => ({ getProperties: vi.fn() }));

vi.mock("@finance/data/ask", () => ask);
vi.mock("@finance/data/properties", () => properties);
vi.mock("../queries/market-quotes", () => ({
  getCachedLiveQuotes: vi.fn(async () => ({})),
}));

const { runAskTool } = await import("./tools");

const ctx = {
  db: {} as never,
  userId: "u1",
  today: "2026-10-10",
  locale: "fr" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAskTool", () => {
  it("says so when the arguments do not fit, without reading anything", async () => {
    const result = await runAskTool(ctx, "cashflow", '{"from":"janvier"}');
    expect(result.ok).toBe(false);
    expect(result.data).toMatchObject({
      error: expect.stringContaining("cashflow"),
    });
    expect(ask.readMonthlyFlows).not.toHaveBeenCalled();
  });

  it("calculates", async () => {
    expect(
      await runAskTool(
        ctx,
        "calculate",
        '{"expression":"(1234.56 - 980) / 980 * 100"}',
      ),
    ).toEqual({
      ok: true,
      data: {
        expression: "(1234.56 - 980) / 980 * 100",
        result: expect.closeTo(25.9755, 3),
      },
    });
    expect(
      (await runAskTool(ctx, "calculate", '{"expression":"1/0"}')).ok,
    ).toBe(false);
  });

  it("hands single entries over signed, largest first when asked", async () => {
    ask.readLedgerRows.mockResolvedValue([
      {
        occurredOn: "2026-10-02",
        note: "SALAIRE",
        amount: 2500,
        category: "Salaire",
        type: "income",
      },
      {
        occurredOn: "2026-10-01",
        note: "CARREFOUR",
        amount: 84.3,
        category: "Courses",
        type: "expense",
      },
      {
        occurredOn: "2026-09-28",
        note: "LOYER",
        amount: 900,
        category: "Logement",
        type: "expense",
      },
    ]);
    const result = await runAskTool(
      ctx,
      "transactions",
      '{"sort":"largest","limit":2,"min":-50}',
    );
    expect(ask.readLedgerRows).toHaveBeenCalledWith(
      ctx.db,
      "u1",
      expect.objectContaining({ min: 50 }),
    );
    expect(result.data).toEqual({
      matched: 3,
      total: 1515.7,
      shown: 2,
      rows: [
        {
          date: "2026-10-02",
          label: "SALAIRE",
          category: "Salaire",
          amount: 2500,
        },
        {
          date: "2026-09-28",
          label: "LOYER",
          category: "Logement",
          amount: -900,
        },
      ],
    });
  });

  it("gathers spending by shop, the latest label naming each", async () => {
    ask.readLedgerRows.mockResolvedValue([
      {
        occurredOn: "2026-10-05",
        note: "CARREFOUR MARKET",
        amount: 40,
        category: "Courses",
        type: "expense",
      },
      {
        occurredOn: "2026-10-01",
        note: "NETFLIX.COM",
        amount: 13.49,
        category: "Abonnements",
        type: "expense",
      },
      {
        occurredOn: "2026-09-20",
        note: "CARREFOUR MARKET",
        amount: 60.5,
        category: "Courses",
        type: "expense",
      },
    ]);
    const result = await runAskTool(ctx, "merchants", "{}");
    expect(ask.readLedgerRows).toHaveBeenCalledWith(ctx.db, "u1", {
      from: "2026-08-01",
      to: "2026-10-10",
      type: "expense",
    });
    expect(result.data).toMatchObject({
      from: "2026-08",
      to: "2026-10",
      merchants: [
        {
          name: "CARREFOUR MARKET",
          spent: 100.5,
          payments: 2,
          last: "2026-10-05",
        },
        { name: "NETFLIX.COM", spent: 13.49, payments: 1, last: "2026-10-01" },
      ],
    });
  });

  it("lays the months out whole, quiet ones included", async () => {
    ask.readMonthlyFlows.mockResolvedValue([
      {
        monthKey: "2026-08",
        income: 2500,
        expense: 1800,
        savings: 200,
        investment: 100,
      },
      {
        monthKey: "2026-10",
        income: 2500,
        expense: 600,
        savings: 0,
        investment: 0,
      },
    ]);
    const result = await runAskTool(ctx, "cashflow", '{"from":"2026-08"}');
    expect(ask.readMonthlyFlows).toHaveBeenCalledWith(
      ctx.db,
      "u1",
      "2026-08-01",
      "2026-10-10",
    );
    expect(result.data).toMatchObject({
      months: [
        {
          month: "2026-08",
          income: 2500,
          spent: 1800,
          saved: 200,
          invested: 100,
          net: 700,
        },
        { month: "2026-09", income: 0, spent: 0, net: 0 },
        { month: "2026-10", partial: true, net: 1900 },
      ],
      totals: {
        income: 5000,
        spent: 2400,
        saved: 200,
        invested: 100,
        net: 2600,
      },
    });
  });

  it("refuses a span the wrong way round or too long", async () => {
    expect(
      (await runAskTool(ctx, "cashflow", '{"from":"2026-09","to":"2026-01"}'))
        .ok,
    ).toBe(false);
    expect((await runAskTool(ctx, "cashflow", '{"from":"2020-01"}')).ok).toBe(
      false,
    );
  });

  describe("loan_prepayment", () => {
    beforeEach(() => {
      properties.getProperties.mockResolvedValue({
        properties: [
          {
            property: { name: "Appartement" },
            loans: [
              {
                id: "loan-1",
                label: "Prêt principal",
                kind: "amortising",
                principal: 200_000,
                annual_rate: 0.035,
                months: 240,
                first_payment_on: "2022-01-05",
                insurance_monthly: 0,
                insurance_rate: null,
                deferral_months: 0,
                deferral_kind: "none",
                known_outstanding: null,
                known_outstanding_on: null,
                known_keeps: null,
                borrower_share: 1,
                fees: 0,
              },
            ],
          },
        ],
      });
    });

    it("ends the loan sooner for the same payment", async () => {
      const result = await runAskTool(
        ctx,
        "loan_prepayment",
        '{"loan_id":"loan-1","amount":10000}',
      );
      const data = result.data as {
        before: { owed: number; monthsLeft: number; nextPayment: number };
        after: { owed: number; monthsLeft: number; nextPayment: number };
        interestSaved: number;
        monthsSooner: number;
      };
      expect(result.ok).toBe(true);
      expect(data.after.owed).toBeCloseTo(data.before.owed - 10_000, 2);
      expect(data.monthsSooner).toBeGreaterThan(0);
      expect(data.interestSaved).toBeGreaterThan(0);
      expect(data.after.nextPayment).toBeCloseTo(data.before.nextPayment, 0);
    });

    it("lowers the payment for the same end", async () => {
      const result = await runAskTool(
        ctx,
        "loan_prepayment",
        '{"loan_id":"loan-1","amount":10000,"keep":"term"}',
      );
      const data = result.data as {
        before: { nextPayment: number };
        after: { nextPayment: number };
        monthsSooner: number;
        interestSaved: number;
      };
      expect(data.monthsSooner).toBe(0);
      expect(data.after.nextPayment).toBeLessThan(data.before.nextPayment);
      expect(data.interestSaved).toBeGreaterThan(0);
    });

    it("says so for a loan it does not know", async () => {
      const result = await runAskTool(
        ctx,
        "loan_prepayment",
        '{"loan_id":"nope","amount":1000}',
      );
      expect(result.ok).toBe(false);
    });
  });
});
