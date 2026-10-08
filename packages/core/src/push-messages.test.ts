import { describe, expect, it } from "vitest";

import { translator } from "./i18n/t";
import type { MonthBalance } from "./month-balance";
import type { CloseableMonth, MonthCloseResult } from "./month-close";
import type { RecurringTemplateWithCategory } from "./types/database";
import {
  bigChargeHeadsUp,
  bigCharges,
  closeReminder,
  monthClosedByBank,
  overdraftWarning,
  plannedChargesOn,
  purchasesToConfirmNotification,
  transferReminderNotification,
  usualChargeAmount,
} from "./push-messages";
import type { PurchaseToConfirm } from "./purchases-to-confirm";

const fr = { t: translator("fr"), locale: "fr" as const };

const september: CloseableMonth = {
  year: 2026,
  month: 9,
  monthKey: "2026-09",
  label: "septembre 2026",
  observeOn: "2026-10-05",
  isBaseline: false,
};

describe("closeReminder", () => {
  it("speaks on the reading day, naming the month", () => {
    const push = closeReminder({
      ...fr,
      next: september,
      today: "2026-10-05",
      closesSoFar: 3,
      streak: 0,
    });
    expect(push?.kind).toBe("close");
    expect(push?.key).toBe("close:2026-09");
    expect(push?.title).toContain("septembre");
  });

  it("mentions the run when there is one", () => {
    const push = closeReminder({
      ...fr,
      next: september,
      today: "2026-10-06",
      closesSoFar: 3,
      streak: 3,
    });
    expect(push?.body).toContain("3 mois");
  });

  it("says nothing before the reading day, for a first close, or with nothing due", () => {
    const base = { ...fr, closesSoFar: 3, streak: 0 };
    expect(
      closeReminder({ ...base, next: september, today: "2026-10-04" }),
    ).toBeNull();
    expect(
      closeReminder({
        ...base,
        next: { ...september, isBaseline: true },
        today: "2026-10-05",
      }),
    ).toBeNull();
    expect(
      closeReminder({
        ...base,
        closesSoFar: 0,
        next: september,
        today: "2026-10-05",
      }),
    ).toBeNull();
    expect(
      closeReminder({ ...base, next: null, today: "2026-10-05" }),
    ).toBeNull();
  });
});

function result(overrides: Partial<MonthCloseResult>): MonthCloseResult {
  return {
    status: "reconciled",
    openingBalance: 1000,
    closingBalance: 1200,
    flows: { income: 2000, expenses: 1500, savings: 100, transfers: 0 },
    kept: 300,
    keptRate: 15,
    unrecorded: 0,
    unexplainedCredit: null,
    ...overrides,
  };
}

describe("monthClosedByBank", () => {
  it("says what the month left", () => {
    const push = monthClosedByBank({
      ...fr,
      monthKey: "2026-09",
      result: result({}),
    });
    expect(push.key).toBe("closed:2026-09");
    expect(push.body).toContain("300");
    expect(push.body).not.toContain("non notées");
  });

  it("adds the unrecorded spending when there was some", () => {
    const push = monthClosedByBank({
      ...fr,
      monthKey: "2026-09",
      result: result({ unrecorded: 85 }),
    });
    expect(push.body).toContain("85");
    expect(push.body).toContain("non notées");
  });

  it("says a month that cost more than it brought plainly", () => {
    const push = monthClosedByBank({
      ...fr,
      monthKey: "2026-09",
      result: result({ kept: -120 }),
    });
    expect(push.body).toContain("120");
    expect(push.body).not.toContain("−120");
  });

  it("calls a first close the starting point", () => {
    const push = monthClosedByBank({
      ...fr,
      monthKey: "2026-09",
      result: result({ status: "baseline", kept: null, unrecorded: null }),
    });
    expect(push.body).toContain("point de départ");
  });
});

describe("bigCharges", () => {
  const charge = (amount: number, yearly = false) => ({
    templateId: `t${amount}`,
    name: `Charge ${amount}`,
    amount,
    yearly,
  });

  it("keeps the yearly ones and those at least twice the usual", () => {
    const picked = bigCharges(
      [charge(60), charge(130), charge(260), charge(40, true)],
      120,
    );
    expect(picked.map((row) => row.amount)).toEqual([260, 40]);
  });

  it("never calls anything under 100 € large", () => {
    expect(bigCharges([charge(90)], 20)).toEqual([]);
    expect(bigCharges([charge(100)], 20).map((row) => row.amount)).toEqual([
      100,
    ]);
  });
});

describe("usualChargeAmount", () => {
  const template = (amount: number, type = "expense", counts = true) => ({
    amount,
    categories: { type, counts_toward_summary: counts },
  });

  it("is the median of the money that leaves by template", () => {
    expect(
      usualChargeAmount([
        template(10),
        template(50),
        template(900),
        template(3000, "income"),
        template(500, "investment", false),
      ]),
    ).toBe(50);
  });

  it("is null with nothing leaving", () => {
    expect(usualChargeAmount([template(3000, "income")])).toBeNull();
  });
});

describe("bigChargeHeadsUp", () => {
  it("names one charge, and lists several", () => {
    const one = bigChargeHeadsUp({
      ...fr,
      tomorrow: "2026-10-06",
      charges: [
        { templateId: "a", name: "Assurance auto", amount: 480, yearly: true },
      ],
    });
    expect(one?.key).toBe("big-charge:2026-10-06");
    expect(one?.title).toContain("Assurance auto");
    expect(one?.body).toContain("une fois par an");

    const several = bigChargeHeadsUp({
      ...fr,
      tomorrow: "2026-10-06",
      charges: [
        { templateId: "a", name: "Assurance auto", amount: 480, yearly: true },
        { templateId: "b", name: "Taxe foncière", amount: 900, yearly: true },
      ],
    });
    expect(several?.title).toContain("2 grosses opérations");
    expect(several?.body).toContain("Taxe foncière");
  });

  it("says nothing with nothing large", () => {
    expect(
      bigChargeHeadsUp({ ...fr, tomorrow: "2026-10-06", charges: [] }),
    ).toBeNull();
  });
});

describe("purchasesToConfirmNotification", () => {
  const purchase = (
    templateId: string,
    occurredOn: string,
    label: string,
  ): PurchaseToConfirm => ({
    key: `${templateId}:${occurredOn}`,
    templateId,
    occurredOn,
    label,
    amount: 150,
    laterDays: [],
  });

  it("asks the morning after, never on the day itself", () => {
    const monday = [purchase("cto", "2026-10-05", "DCA CTO")];
    expect(
      purchasesToConfirmNotification({
        ...fr,
        purchases: monday,
        today: "2026-10-05",
      }),
    ).toBeNull();

    const push = purchasesToConfirmNotification({
      ...fr,
      purchases: monday,
      today: "2026-10-06",
    });
    expect(push?.kind).toBe("dca");
    expect(push?.key).toBe("dca:2026-10-05");
    expect(push?.url).toBe("/bearing");
    expect(push?.title).toBe("DCA CTO\u00A0: c'est passé\u00A0?");
    expect(push?.body).toContain("150");
    expect(push?.body).toContain("lun. 5 oct.");
  });

  it("is keyed by the latest day, so a new purchase asks again", () => {
    const tuesday = purchasesToConfirmNotification({
      ...fr,
      purchases: [purchase("cto", "2026-10-05", "DCA CTO")],
      today: "2026-10-07",
    });
    const nextWeek = purchasesToConfirmNotification({
      ...fr,
      purchases: [
        purchase("cto", "2026-10-05", "DCA CTO"),
        purchase("cto", "2026-10-12", "DCA CTO"),
        purchase("pea", "2026-10-12", "DCA PEA"),
      ],
      today: "2026-10-13",
    });
    expect(tuesday?.key).toBe("dca:2026-10-05");
    expect(nextWeek?.key).toBe("dca:2026-10-12");
    expect(nextWeek?.title).toBe("3 achats à confirmer");
    expect(nextWeek?.body).toBe(
      "DCA CTO, DCA PEA\u00A0: dites sur Le point s'ils sont passés.",
    );
  });
});

describe("transferReminderNotification", () => {
  it("says what to send and what it is made of", () => {
    const push = transferReminderNotification({
      ...fr,
      reminder: {
        templateId: "transfer",
        label: "Virement Boursorama",
        occurredOn: "2026-11-01",
        need: {
          year: 2026,
          month: 11,
          cost: 2050,
          margin: 82.5,
          amount: 2150,
          count: 6,
          byWallet: [
            { wallet: "cto", cost: 1650, count: 5 },
            { wallet: "pea", cost: 400, count: 1 },
          ],
        },
      },
    });
    expect(push.kind).toBe("dca");
    expect(push.key).toBe("dca-transfer-soon:2026-11");
    expect(push.title).toBe(
      "À préparer pour novembre\u00A0: 2\u202F150\u00A0€",
    );
    expect(push.body).toBe(
      "Pour les DCA prévus en novembre\u00A0: CTO 1\u202F650\u00A0€ · PEA 400\u00A0€. Arrondi, avec 5\u00A0% de marge sur ceux achetés en parts.",
    );
  });
});

describe("plannedChargesOn", () => {
  const template = (
    overrides: Partial<RecurringTemplateWithCategory>,
  ): RecurringTemplateWithCategory =>
    ({
      id: "t1",
      user_id: "u",
      category_id: "c",
      amount: 480,
      description: "Assurance auto",
      recurrence: "monthly",
      day_of_month: 6,
      day_of_week: null,
      month_of_year: null,
      starts_on: null,
      ends_on: null,
      active: true,
      pricing_type: "fixed",
      share_count: null,
      instrument_symbol: null,
      instrument_name: null,
      last_quote_price: null,
      last_quote_at: null,
      created_at: "2026-01-01T00:00:00Z",
      categories: {
        name: "Assurance",
        type: "expense",
        icon: null,
        counts_toward_summary: true,
      },
      ...overrides,
    }) as RecurringTemplateWithCategory;

  it("finds the charges due that day", () => {
    expect(
      plannedChargesOn([template({})], "2026-10-06", new Set()).map(
        (row) => row.name,
      ),
    ).toEqual(["Assurance auto"]);
  });

  it("leaves out income, wallet purchases, skips and other days", () => {
    const skipped = new Set(["t1:2026-10-06"]);
    expect(plannedChargesOn([template({})], "2026-10-06", skipped)).toEqual([]);
    expect(
      plannedChargesOn(
        [
          template({
            categories: {
              name: "Salaire",
              type: "income",
              icon: null,
              counts_toward_summary: true,
            },
          }),
        ],
        "2026-10-06",
        new Set(),
      ),
    ).toEqual([]);
    expect(
      plannedChargesOn(
        [
          template({
            categories: {
              name: "DCA PEA",
              type: "investment",
              icon: null,
              counts_toward_summary: false,
            },
          }),
        ],
        "2026-10-06",
        new Set(),
      ),
    ).toEqual([]);
    expect(plannedChargesOn([template({})], "2026-10-07", new Set())).toEqual(
      [],
    );
  });
});

describe("overdraftWarning", () => {
  const october: MonthBalance = {
    period: "current",
    basis: "balance",
    start: 400,
    today: 250,
    end: 320,
    points: [],
    lowest: { date: "2026-10-24", value: -120 },
  };

  it("warns ahead of the day the account goes below zero", () => {
    const push = overdraftWarning({
      ...fr,
      balance: october,
      source: "bank",
      today: "2026-10-12",
    });
    expect(push?.kind).toBe("overdraft");
    expect(push?.key).toBe("overdraft:2026-10");
    expect(push?.title).toBe("Découvert possible le 24 oct.");
    expect(push?.body).toContain("remonterait");
  });

  it("says when the month ends below zero too", () => {
    const push = overdraftWarning({
      ...fr,
      balance: { ...october, end: -40 },
      source: "close",
      today: "2026-10-12",
    });
    expect(push?.body).toContain("finirait le mois");
  });

  it("stays quiet on a net, on no balance, and on a dip already here", () => {
    const base = { ...fr, today: "2026-10-12" };
    expect(
      overdraftWarning({
        ...base,
        balance: { ...october, basis: "net" },
        source: "none",
      }),
    ).toBeNull();
    expect(
      overdraftWarning({ ...base, balance: october, source: "none" }),
    ).toBeNull();
    expect(
      overdraftWarning({
        ...base,
        balance: { ...october, lowest: { date: "2026-10-12", value: -5 } },
        source: "bank",
      }),
    ).toBeNull();
    expect(
      overdraftWarning({
        ...base,
        balance: { ...october, lowest: { date: "2026-10-24", value: 10 } },
        source: "bank",
      }),
    ).toBeNull();
  });
});
