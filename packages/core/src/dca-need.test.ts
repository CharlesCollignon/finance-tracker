import { describe, expect, it } from "vitest";

import {
  dcaMonth,
  dcaNeedForMonth,
  paydayKeyOf,
  plannedOccurrenceNote,
  transferCoversMonth,
  transferReminder,
} from "./dca-need";
import { translator } from "./i18n/t";
import { monthStartingNearest } from "./recurrence";
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
    // Ticked, as every DCA bought at the broker is by default.
    funded_by_transfer: !counts,
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

function income(
  id: string,
  options: Partial<RecurringTemplateWithCategory> = {},
): RecurringTemplateWithCategory {
  return {
    ...template(id, "Salaire", { counts: true, ...options }),
    categories: {
      name: "Salaire",
      type: "income",
      icon: null,
      counts_toward_summary: true,
    },
  };
}

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

describe("the month a transfer on the 1st covers", () => {
  it("is the month it opens", () => {
    const onTheFirst = template("transfer", "Virement vers le courtier", {
      counts: true,
      day_of_month: 1,
    });
    expect(transferCoversMonth(onTheFirst, "2026-10-27")).toEqual({
      year: 2026,
      month: 11,
      occurredOn: "2026-11-01",
    });
  });
});

describe("dcaMonth", () => {
  const transfer = template("transfer", "Virement vers le courtier", {
    counts: true,
    day_of_month: 1,
    pricing_type: "purchases",
    description: "Virement Boursorama",
    amount: 2150,
  });
  const all = [cto, pea, transfer];
  const sent = (...days: string[]) =>
    new Set(days.map((day) => `transfer:${day}`));

  it("tells the month in progress, before the next one is near", () => {
    // October: the CTO on four Mondays and the PEA on the 5th; three done.
    const month = dcaMonth({
      templates: all,
      today: "2026-10-20",
      settledKeys: sent("2026-10-01"),
      writtenKeys: new Set([
        "cto:2026-10-05",
        "cto:2026-10-12",
        "pea:2026-10-05",
      ]),
    });
    expect(month).toMatchObject({
      occurredOn: "2026-10-01",
      state: "sent",
      need: { month: 10 },
      progress: { done: 3, total: 5 },
      run: 1,
    });
  });

  it("calls a past month's transfer nobody saw unseen", () => {
    expect(dcaMonth({ templates: all, today: "2026-10-20" })?.state).toBe(
      "unseen",
    );
  });

  it("turns to next month five days before its 1st, to send", () => {
    expect(dcaMonth({ templates: all, today: "2026-10-26" })?.need.month).toBe(
      10,
    );
    const month = dcaMonth({ templates: all, today: "2026-10-27" });
    expect(month).toMatchObject({
      occurredOn: "2026-11-01",
      state: "to-send",
      need: { month: 11, amount: 2150 },
    });
    // The card, not yet the push.
    expect(transferReminder(month, "2026-10-27")).toBeNull();
  });

  it("pushes two days before its 1st, not with the card", () => {
    const month = dcaMonth({ templates: all, today: "2026-10-30" });
    expect(transferReminder(month, "2026-10-30")).toMatchObject({
      label: "Virement Boursorama",
      occurredOn: "2026-11-01",
      need: { amount: 2150 },
    });
    // Still said if it is late: the transfer counts for ten days after.
    const late = dcaMonth({ templates: all, today: "2026-11-03" });
    expect(transferReminder(late, "2026-11-03")).toMatchObject({
      occurredOn: "2026-11-01",
    });
  });

  it("comes early, card and push, once the salary it is sent from is in", () => {
    // Paid on the 24th: eight days before the 1st, before the card's five.
    const salary = income("salary", { day_of_month: 24, amount: 3200 });
    const templates = [...all, salary];
    expect(dcaMonth({ templates, today: "2026-10-24" })?.need.month).toBe(10);
    const month = dcaMonth({
      templates,
      today: "2026-10-24",
      paidKeys: new Set(["salary:2026-10-24"]),
    });
    expect(month).toMatchObject({
      occurredOn: "2026-11-01",
      state: "to-send",
      paid: true,
    });
    expect(transferReminder(month, "2026-10-24")).toMatchObject({
      due: false,
      paid: true,
    });
    // Two days before, both are due.
    const later = dcaMonth({
      templates,
      today: "2026-10-30",
      paidKeys: new Set(["salary:2026-10-24"]),
    });
    expect(transferReminder(later, "2026-10-30")).toMatchObject({
      due: true,
      paid: true,
    });
  });

  it("says sent as soon as it is, even early, and counts the run", () => {
    const month = dcaMonth({
      templates: all,
      today: "2026-10-30",
      settledKeys: sent("2026-10-01", "2026-11-01"),
    });
    expect(month).toMatchObject({
      occurredOn: "2026-11-01",
      state: "sent",
      run: 2,
    });
    expect(transferReminder(month, "2026-10-30")).toBeNull();
  });

  it("keeps it to send a few days late, then unseen", () => {
    expect(dcaMonth({ templates: all, today: "2026-11-03" })?.state).toBe(
      "to-send",
    );
    expect(dcaMonth({ templates: all, today: "2026-11-15" })?.state).toBe(
      "unseen",
    );
  });

  it("does not break the run for a transfer still on its way", () => {
    expect(
      dcaMonth({
        templates: all,
        today: "2026-11-03",
        settledKeys: sent("2026-09-01", "2026-10-01"),
      })?.run,
    ).toBe(2);
  });

  it("follows the ticks", () => {
    const unticked = { ...cto, funded_by_transfer: false };
    expect(
      dcaMonth({ templates: [unticked, pea, transfer], today: "2026-10-27" })
        ?.need,
    ).toMatchObject({ amount: 400, count: 1 });
    expect(
      dcaMonth({
        templates: [unticked, { ...pea, funded_by_transfer: false }, transfer],
        today: "2026-10-27",
      }),
    ).toBeNull();
  });

  it("shows a new transfer's first month at once, but pushes it on its day", () => {
    const fresh = { ...transfer, created_at: "2026-10-07T08:00:00Z" };
    const month = dcaMonth({
      templates: [cto, pea, fresh],
      today: "2026-10-08",
    });
    expect(month).toMatchObject({ occurredOn: "2026-11-01", state: "to-send" });
    // What happened on 8 October 2026: the push came with the card.
    expect(transferReminder(month, "2026-10-08")).toBeNull();
  });

  it("is nothing without the app's transfer, or with it paused", () => {
    expect(dcaMonth({ templates: [cto, pea], today: "2026-10-27" })).toBeNull();
    expect(
      dcaMonth({
        templates: [cto, pea, { ...transfer, active: false }],
        today: "2026-10-27",
      }),
    ).toBeNull();
  });
});

describe("paydayKeyOf", () => {
  it("is the largest salary's occurrence nearest the transfer's day", () => {
    const salary = income("salary", { day_of_month: 28, amount: 3200 });
    const bonus = income("bonus", { day_of_month: 30, amount: 150 });
    expect(paydayKeyOf([salary, bonus], "2026-11-01")).toBe(
      "salary:2026-10-28",
    );
  });

  it("takes a salary kept on the 1st, paid early, as its own", () => {
    const salary = income("salary", { day_of_month: 1, amount: 3200 });
    expect(paydayKeyOf([salary], "2026-11-01")).toBe("salary:2026-11-01");
  });

  it("is nothing without a salary near enough, or any at all", () => {
    expect(
      paydayKeyOf([income("salary", { day_of_month: 15 })], "2026-11-01"),
    ).toBeNull();
    expect(paydayKeyOf([cto, pea], "2026-11-01")).toBeNull();
  });
});

describe("the transfer in the Journal", () => {
  it("pays for the month that starts nearest its day", () => {
    expect(monthStartingNearest("2026-11-01")).toEqual({
      year: 2026,
      month: 11,
    });
    expect(monthStartingNearest("2026-10-28")).toEqual({
      year: 2026,
      month: 11,
    });
    expect(monthStartingNearest("2026-12-20")).toEqual({
      year: 2027,
      month: 1,
    });
  });

  it("says which month's DCAs it pays for, instead of a note", () => {
    const t = translator("fr");
    expect(
      plannedOccurrenceNote({ note: null, coversDcaMonth: 11 }, t, "fr"),
    ).toBe("Pour les DCA prévus en novembre");
    expect(plannedOccurrenceNote({ note: "Loyer" }, t, "fr")).toBe("Loyer");
  });
});
