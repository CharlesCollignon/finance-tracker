import { describe, expect, it } from "vitest";

import {
  amountsMatch,
  bankForecast,
  confirmLabel,
  countsForMonthOf,
  describeFulfilment,
  fulfilmentScope,
  proposalsForMonth,
  type FulfilmentProposal,
  describeMiss,
  explainFulfilmentMisses,
  proposeFulfilments,
  refusalKey,
  type FulfilmentMovement,
  type FulfilmentOccurrence,
} from "./recurring-fulfilment";

const RENT_CATEGORY = "cat-rent";
const SALARY_CATEGORY = "cat-salary";

function occurrence(
  partial: Partial<FulfilmentOccurrence> = {},
): FulfilmentOccurrence {
  return {
    templateId: "tpl-rent",
    occurredOn: "2026-09-05",
    amount: 780,
    categoryId: RENT_CATEGORY,
    categoryType: "expense",
    label: "Rent",
    ...partial,
  };
}

function movement(
  partial: Partial<FulfilmentMovement> = {},
): FulfilmentMovement {
  return {
    transactionId: "tx-1",
    occurredOn: "2026-09-04",
    amount: 780,
    categoryId: RENT_CATEGORY,
    note: "PRELEVEMENT LOYER",
    ...partial,
  };
}

const money = (amount: number) => `${amount.toFixed(2)} €`;

/**
 * Late enough that every fixture movement is in the past.
 *
 * The fixtures are about matching, not about arrival, so they are dated
 * mid-month and asked about from the end of it. The arrival rule has its own
 * block below.
 */
const TODAY = "2026-09-30";

describe("amountsMatch", () => {
  it("accepts a salary that moved with overtime", () => {
    expect(amountsMatch(3400, 3433.14)).toBe(true);
  });

  it("refuses a difference beyond five per cent", () => {
    expect(amountsMatch(3400, 3600)).toBe(false);
  });

  it("uses an absolute floor on small amounts", () => {
    // Five per cent of €4 is 20 cents, which no real charge respects.
    expect(amountsMatch(4, 5)).toBe(true);
    expect(amountsMatch(4, 6.5)).toBe(false);
  });

  it("is symmetric", () => {
    expect(amountsMatch(100, 104)).toBe(amountsMatch(104, 100));
  });
});

describe("proposeFulfilments", () => {
  it("pairs a charge with the bank row that looks like it", () => {
    const [proposal] = proposeFulfilments([occurrence()], [movement()], {
      today: TODAY,
    });

    expect(proposal).toMatchObject({
      key: "tpl-rent:2026-09-05",
      templateId: "tpl-rent",
      transactionId: "tx-1",
      expectedAmount: 780,
      actualAmount: 780,
      difference: 0,
      daysApart: 1,
    });
  });

  it("reports the difference signed", () => {
    const [proposal] = proposeFulfilments(
      [occurrence({ amount: 3400, categoryId: SALARY_CATEGORY })],
      [movement({ amount: 3433.14, categoryId: SALARY_CATEGORY })],
      { today: TODAY },
    );

    expect(proposal!.difference).toBe(33.14);
  });

  it("never pairs across categories", () => {
    // The category is the one signal that is a fact rather than a
    // coincidence: two €780 movements in a month are not the same charge just
    // because they are the same size.
    expect(
      proposeFulfilments(
        [occurrence()],
        [movement({ categoryId: SALARY_CATEGORY })],
        { today: TODAY },
      ),
    ).toEqual([]);
  });

  it("refuses a movement too far from the occurrence", () => {
    expect(
      proposeFulfilments(
        [occurrence()],
        [movement({ occurredOn: "2026-09-11" })],
        { today: TODAY },
      ),
    ).toEqual([]);
  });

  it("refuses a movement of the wrong size", () => {
    expect(
      proposeFulfilments([occurrence()], [movement({ amount: 980 })], {
        today: TODAY,
      }),
    ).toEqual([]);
  });

  describe("one for one", () => {
    it("does not let one payment cancel two occurrences", () => {
      // Otherwise a single rent debit halves the month's expected outgoings.
      const proposals = proposeFulfilments(
        [
          occurrence({ occurredOn: "2026-09-05" }),
          occurrence({ occurredOn: "2026-09-06" }),
        ],
        [movement()],
        { today: TODAY },
      );

      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.occurredOn).toBe("2026-09-05");
    });

    it("does not let one occurrence claim two payments", () => {
      const proposals = proposeFulfilments(
        [occurrence()],
        [
          movement({ transactionId: "tx-1", occurredOn: "2026-09-04" }),
          movement({ transactionId: "tx-2", occurredOn: "2026-09-05" }),
        ],
        { today: TODAY },
      );

      expect(proposals).toHaveLength(1);
      // The nearer date wins: two charges of a size are usually the same
      // standing charge twice, two on a day are usually unrelated.
      expect(proposals[0]!.transactionId).toBe("tx-2");
    });

    it("pairs two occurrences with two payments, nearest first", () => {
      const proposals = proposeFulfilments(
        [
          occurrence({ templateId: "tpl-a", occurredOn: "2026-09-05" }),
          occurrence({
            templateId: "tpl-b",
            occurredOn: "2026-09-20",
            categoryId: SALARY_CATEGORY,
            amount: 3400,
          }),
        ],
        [
          movement({ transactionId: "tx-1", occurredOn: "2026-09-05" }),
          movement({
            transactionId: "tx-2",
            occurredOn: "2026-09-21",
            amount: 3400,
            categoryId: SALARY_CATEGORY,
          }),
        ],
        { today: TODAY },
      );

      expect(proposals.map((p) => [p.templateId, p.transactionId])).toEqual([
        ["tpl-a", "tx-1"],
        ["tpl-b", "tx-2"],
      ]);
    });
  });

  describe("what is already decided", () => {
    it("skips an occurrence already fulfilled", () => {
      expect(
        proposeFulfilments([occurrence()], [movement()], {
          today: TODAY,
          fulfilledKeys: new Set(["tpl-rent:2026-09-05"]),
        }),
      ).toEqual([]);
    });

    it("skips a transaction already standing in for something", () => {
      expect(
        proposeFulfilments([occurrence()], [movement()], {
          today: TODAY,
          claimedTransactionIds: new Set(["tx-1"]),
        }),
      ).toEqual([]);
    });

    it("does not offer a pairing the user refused", () => {
      expect(
        proposeFulfilments([occurrence()], [movement()], {
          today: TODAY,
          refusedPairs: new Set([refusalKey("tpl-rent", "2026-09-05", "tx-1")]),
        }),
      ).toEqual([]);
    });

    it("still offers a better candidate after a refusal", () => {
      // The refusal names the pair, not the occurrence: "not that payment"
      // must not mean "never ask about the 5th again".
      const proposals = proposeFulfilments(
        [occurrence()],
        [
          movement({ transactionId: "tx-1", occurredOn: "2026-09-03" }),
          movement({ transactionId: "tx-2", occurredOn: "2026-09-05" }),
        ],
        {
          today: TODAY,
          refusedPairs: new Set([refusalKey("tpl-rent", "2026-09-05", "tx-2")]),
        },
      );

      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.transactionId).toBe("tx-1");
    });
  });

  it("lists proposals in the order the month happened", () => {
    const proposals = proposeFulfilments(
      [
        occurrence({ templateId: "tpl-late", occurredOn: "2026-09-20" }),
        occurrence({ templateId: "tpl-early", occurredOn: "2026-09-02" }),
      ],
      [
        movement({ transactionId: "tx-late", occurredOn: "2026-09-20" }),
        movement({ transactionId: "tx-early", occurredOn: "2026-09-02" }),
      ],
      { today: TODAY },
    );

    expect(proposals.map((p) => p.actualOn)).toEqual([
      "2026-09-02",
      "2026-09-20",
    ]);
  });
});

describe("describeFulfilment", () => {
  it("says so when the amount is exact", () => {
    const [proposal] = proposeFulfilments(
      [occurrence()],
      [movement({ occurredOn: "2026-09-05" })],
      { today: TODAY },
    );

    expect(describeFulfilment(proposal!, money, "en")).toBe(
      "The same to the cent, on the day it was due",
    );
  });

  it("leads with the difference, which is the part worth reading", () => {
    const [proposal] = proposeFulfilments(
      [occurrence({ amount: 3400, categoryId: SALARY_CATEGORY })],
      [
        movement({
          amount: 3433.14,
          categoryId: SALARY_CATEGORY,
          occurredOn: "2026-09-07",
        }),
      ],
      { today: TODAY },
    );

    expect(describeFulfilment(proposal!, money, "en")).toBe(
      "33.14 € more than expected, 2 days late",
    );
  });

  it("says early when the money came first", () => {
    const [proposal] = proposeFulfilments(
      [occurrence()],
      [movement({ amount: 770, occurredOn: "2026-09-04" })],
      { today: TODAY },
    );

    expect(describeFulfilment(proposal!, money, "en")).toBe(
      "10.00 € less than expected, 1 day early",
    );
  });
});

describe("only what has actually arrived", () => {
  /**
   * The bug this exists for, from a real screenshot: the Month page offered
   * "EDF −60 € Thu 17 Sep · the same to the cent, on the day it was due" on
   * the 4th. Both sides were forecasts — an EDF row dated the 17th against an
   * EDF occurrence dated the 17th — so the app was asking whether something
   * thirteen days away had happened, and a press would have removed a real
   * upcoming charge from the month's outgoings.
   */
  it("does not offer a movement dated in the future", () => {
    expect(
      proposeFulfilments(
        [occurrence({ occurredOn: "2026-09-17", amount: 60 })],
        [movement({ occurredOn: "2026-09-17", amount: 60 })],
        { today: "2026-09-04" },
      ),
    ).toEqual([]);
  });

  it("offers one dated today", () => {
    // The boundary belongs to the past: a charge that landed this morning has
    // arrived, and waiting until tomorrow to say so would be arbitrary.
    const proposals = proposeFulfilments(
      [occurrence({ occurredOn: "2026-09-05" })],
      [movement({ occurredOn: "2026-09-04" })],
      { today: "2026-09-04" },
    );

    expect(proposals).toHaveLength(1);
  });

  it("still matches a past movement to a future occurrence", () => {
    // The case the feature exists for: the charge is due on the 5th, the bank
    // took it on the 3rd, and it is the 4th. The occurrence is ahead of
    // today; the movement is not.
    const proposals = proposeFulfilments(
      [occurrence({ occurredOn: "2026-09-05" })],
      [movement({ occurredOn: "2026-09-03" })],
      { today: "2026-09-04" },
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.occurredOn).toBe("2026-09-05");
    expect(proposals[0]!.actualOn).toBe("2026-09-03");
  });

  it("prefers a movement that has happened over a nearer one that has not", () => {
    // Closeness decides between candidates, but only among candidates. A
    // future row is not a candidate at all, however exact.
    const proposals = proposeFulfilments(
      [occurrence({ occurredOn: "2026-09-05" })],
      [
        movement({ transactionId: "tx-past", occurredOn: "2026-09-03" }),
        movement({ transactionId: "tx-future", occurredOn: "2026-09-05" }),
      ],
      { today: "2026-09-04" },
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.transactionId).toBe("tx-past");
  });
});

describe("explainFulfilmentMisses", () => {
  /**
   * The report this exists for: "there are two identical Transportation
   * charges in my ledger and neither was proposed." Narrow thresholds are
   * right, and a narrow matcher that says nothing is indistinguishable from a
   * broken one.
   */
  function explain(
    occurrences: FulfilmentOccurrence[],
    movements: FulfilmentMovement[],
    today = TODAY,
  ) {
    const proposals = proposeFulfilments(occurrences, movements, { today });
    return explainFulfilmentMisses(occurrences, movements, proposals, {
      today,
    });
  }

  it("says nothing to match when the category is empty", () => {
    const [miss] = explain(
      [occurrence()],
      [movement({ categoryId: SALARY_CATEGORY })],
    );

    expect(miss).toMatchObject({ reason: "nothing-alike", nearest: null });
    expect(describeMiss(miss!, money, "en")).toBe(
      "nothing in its category to match",
    );
  });

  it("blames the amount when the date was fine", () => {
    const [miss] = explain(
      [occurrence()],
      [movement({ amount: 980, occurredOn: "2026-09-05" })],
    );

    expect(miss!.reason).toBe("amount");
    expect(describeMiss(miss!, money, "en")).toBe(
      "nearest was 980.00 €, too far from 780.00 €",
    );
  });

  it("blames the window when the amount was exact", () => {
    // The likeliest cause of a real miss: a charge the bank takes nine days
    // from the day the template names.
    const [miss] = explain(
      [occurrence({ occurredOn: "2026-09-14" })],
      [movement({ occurredOn: "2026-09-04" })],
    );

    expect(miss!.reason).toBe("date");
    expect(describeMiss(miss!, money, "en")).toBe(
      "nearest was 10 days from the planned date, more than the 4 days it looks within",
    );
  });

  it("says so when the only candidate is still in the future", () => {
    const [miss] = explain(
      [occurrence({ occurredOn: "2026-09-17" })],
      [movement({ occurredOn: "2026-09-17" })],
      "2026-09-04",
    );

    expect(miss!.reason).toBe("not-arrived");
    expect(describeMiss(miss!, money, "en")).toBe(
      "the nearest movement has not happened yet",
    );
  });

  /**
   * A date miss is never one day out, so the singular form of the window
   * message is unreachable: missing by a day is inside `MAX_DAYS_APART` and
   * would have been offered. The plural stays a plural anyway, for the reason
   * `pluralCategory` keeps French's `many` — a message that cannot express its
   * own smallest case is a ternary with extra steps — but the floor is worth
   * pinning, so nobody reads "{count} days" as a bug.
   */
  it("never misses the window by fewer than five days", () => {
    const [justOutside] = explain(
      [occurrence({ occurredOn: "2026-09-09" })],
      [movement({ occurredOn: "2026-09-04" })],
    );

    expect(justOutside).toMatchObject({ reason: "date" });
    expect(justOutside!.nearest!.daysApart).toBe(5);
    expect(describeMiss(justOutside!, money, "en")).toBe(
      "nearest was 5 days from the planned date, more than the 4 days it looks within",
    );

    // One day closer and it is a proposal, not a miss.
    expect(
      explain(
        [occurrence({ occurredOn: "2026-09-08" })],
        [movement({ occurredOn: "2026-09-04" })],
      ),
    ).toEqual([]);
  });

  it("answers in the language it is asked in", () => {
    const [miss] = explain(
      [occurrence()],
      [movement({ categoryId: SALARY_CATEGORY })],
    );

    expect(describeMiss(miss!, money, "fr")).toBe(
      "rien dans sa catégorie à rapprocher",
    );

    const [tooFar] = explain(
      [occurrence()],
      [movement({ amount: 980, occurredOn: "2026-09-05" })],
    );

    expect(describeMiss(tooFar!, money, "fr")).toBe(
      "le plus proche était 980.00 €, trop loin de 780.00 €",
    );
  });

  it("remembers a refusal rather than blaming the data", () => {
    const occurrences = [occurrence()];
    const movements = [movement()];
    const refusedPairs = new Set([
      refusalKey("tpl-rent", "2026-09-05", "tx-1"),
    ]);

    const proposals = proposeFulfilments(occurrences, movements, {
      today: TODAY,
      refusedPairs,
    });
    const [miss] = explainFulfilmentMisses(occurrences, movements, proposals, {
      today: TODAY,
      refusedPairs,
    });

    expect(miss!.reason).toBe("refused");
  });

  it("explains nothing that was offered or already answered", () => {
    // Together with the proposals this accounts for every occurrence exactly
    // once, which is what makes the pair trustworthy as a report.
    expect(explain([occurrence()], [movement()])).toEqual([]);

    const occurrences = [occurrence()];
    const movements = [movement()];
    const fulfilledKeys = new Set(["tpl-rent:2026-09-05"]);
    const proposals = proposeFulfilments(occurrences, movements, {
      today: TODAY,
      fulfilledKeys,
    });

    expect(
      explainFulfilmentMisses(occurrences, movements, proposals, {
        today: TODAY,
        fulfilledKeys,
      }),
    ).toEqual([]);
  });
});

describe("money that moves on payday, early or late", () => {
  // A salary due on the 1st of October, paid on 22 September.
  const salary = occurrence({
    templateId: "tpl-salary",
    occurredOn: "2026-10-01",
    amount: 2400,
    categoryId: SALARY_CATEGORY,
    categoryType: "income",
    label: "Salaire",
    recurrence: "monthly",
  });
  const paid = movement({
    transactionId: "tx-salary",
    occurredOn: "2026-09-22",
    amount: 2400,
    categoryId: SALARY_CATEGORY,
    note: "VIR SALAIRE",
  });

  it("offers a salary paid nine days early for the month it pays", () => {
    const [proposal] = proposeFulfilments([salary], [paid], { today: TODAY });
    expect(proposal).toMatchObject({
      occurredOn: "2026-10-01",
      transactionId: "tx-salary",
      daysApart: 9,
      countsForMonth: "2026-10",
    });
  });

  it("says where it will count, and the button says so too", () => {
    const [proposal] = proposeFulfilments([salary], [paid], { today: TODAY });
    expect(describeFulfilment(proposal!, money, "fr")).toBe(
      "Au centime près, 9 jours d'avance — à compter pour octobre",
    );
    expect(confirmLabel(proposal!, "fr")).toBe("Compter pour octobre");
    expect(confirmLabel(proposal!, "en")).toBe("Count it for October");
  });

  it("offers a transfer that follows the DCAs whatever was sent", () => {
    // The charge says 1 750 € for November's DCAs; 1 600 € left on the 27th.
    const transfer = occurrence({
      templateId: "tpl-transfer",
      occurredOn: "2026-10-28",
      amount: 1750,
      categoryId: "cat-broker",
      categoryType: "investment",
      label: "Virement vers le courtier",
      recurrence: "monthly",
      anyAmount: true,
    });
    const sent = movement({
      transactionId: "tx-transfer",
      occurredOn: "2026-10-27",
      amount: 1600,
      categoryId: "cat-broker",
      note: "VIR BOURSORAMA",
    });
    expect(
      proposeFulfilments([transfer], [sent], { today: "2026-10-30" }),
    ).toMatchObject([{ transactionId: "tx-transfer", difference: -150 }]);
    // Any other charge still has to be within 5 % of what it says.
    expect(
      proposeFulfilments([{ ...transfer, anyAmount: undefined }], [sent], {
        today: "2026-10-30",
      }),
    ).toEqual([]);
  });

  it("moves the savings and the broker transfer put by the same day", () => {
    const savings = occurrence({
      templateId: "tpl-livret",
      occurredOn: "2026-10-02",
      amount: 300,
      categoryId: "cat-livret",
      categoryType: "savings",
      recurrence: "monthly",
    });
    const broker = occurrence({
      templateId: "tpl-broker",
      occurredOn: "2026-10-03",
      amount: 500,
      categoryId: "cat-broker",
      categoryType: "investment",
      recurrence: "monthly",
    });
    const proposals = proposeFulfilments(
      [salary, savings, broker],
      [
        paid,
        movement({
          transactionId: "tx-livret",
          occurredOn: "2026-09-23",
          amount: 300,
          categoryId: "cat-livret",
        }),
        movement({
          transactionId: "tx-broker",
          occurredOn: "2026-09-23",
          amount: 500,
          categoryId: "cat-broker",
        }),
      ],
      { today: TODAY },
    );
    expect(proposals.map((proposal) => proposal.countsForMonth)).toEqual([
      "2026-10",
      "2026-10",
      "2026-10",
    ]);
  });

  it("brings a late salary back to the month it was planned for", () => {
    const [proposal] = proposeFulfilments(
      [{ ...salary, occurredOn: "2026-10-31" }],
      [{ ...paid, occurredOn: "2026-11-02" }],
      { today: "2026-11-05" },
    );
    expect(proposal).toMatchObject({ daysApart: 2, countsForMonth: "2026-10" });
    expect(describeFulfilment(proposal!, money, "fr")).toBe(
      "Au centime près, 2 jours de retard — à compter pour octobre",
    );
  });

  it("stays in its month when it is early inside it", () => {
    const [proposal] = proposeFulfilments(
      [{ ...salary, occurredOn: "2026-09-28" }],
      [paid],
      { today: TODAY },
    );
    expect(proposal).toMatchObject({ daysApart: 6, countsForMonth: null });
    expect(confirmLabel(proposal!, "fr")).toBe("C'est ça");
  });

  it("gives fifteen days before and ten after, no more", () => {
    const early = (on: string) =>
      proposeFulfilments([salary], [{ ...paid, occurredOn: on }], {
        today: "2026-11-30",
      });
    expect(early("2026-09-16")).toHaveLength(1);
    expect(early("2026-09-15")).toEqual([]);
    expect(early("2026-10-11")).toHaveLength(1);
    expect(early("2026-10-12")).toEqual([]);
  });

  it("keeps a rent to four days either way, and moves it across a month", () => {
    const rent = occurrence({ occurredOn: "2026-10-01" });
    expect(
      proposeFulfilments([rent], [movement({ occurredOn: "2026-09-22" })], {
        today: TODAY,
      }),
    ).toEqual([]);
    const [proposal] = proposeFulfilments(
      [rent],
      [movement({ occurredOn: "2026-09-29" })],
      { today: TODAY },
    );
    expect(proposal?.countsForMonth).toBe("2026-10");
  });

  it("never widens a weekly template, which would reach two occurrences", () => {
    expect(
      proposeFulfilments([{ ...salary, recurrence: "weekly" }], [paid], {
        today: TODAY,
      }),
    ).toEqual([]);
  });

  it("reports the wider window when it is still too early", () => {
    const [miss] = explainFulfilmentMisses(
      [salary],
      [{ ...paid, occurredOn: "2026-09-10" }],
      [],
      { today: TODAY },
    );
    expect(miss).toMatchObject({ reason: "date" });
    expect(miss!.nearest).toMatchObject({ daysApart: 21, window: 15 });
  });

  it("names the month a pairing moves to only when the months differ", () => {
    expect(countsForMonthOf({ occurredOn: "2026-10-01" }, "2026-09-22")).toBe(
      "2026-10",
    );
    expect(countsForMonthOf({ occurredOn: "2026-10-31" }, "2026-11-02")).toBe(
      "2026-10",
    );
    expect(
      countsForMonthOf({ occurredOn: "2026-09-28" }, "2026-09-22"),
    ).toBeNull();
  });
});

describe("which month asks", () => {
  it("draws on the neighbouring months and reads around them", () => {
    expect(fulfilmentScope(2026, 10)).toEqual({
      months: [
        { year: 2026, month: 9 },
        { year: 2026, month: 10 },
        { year: 2026, month: 11 },
      ],
      from: "2026-08-17",
      to: "2026-12-10",
    });
    expect(fulfilmentScope(2026, 1).months[0]).toEqual({
      year: 2025,
      month: 12,
    });
  });

  it("asks in the month the money moved and the month it was planned for", () => {
    const early = {
      occurredOn: "2026-10-01",
      actualOn: "2026-09-22",
    } as FulfilmentProposal;
    const elsewhere = {
      occurredOn: "2026-08-01",
      actualOn: "2026-08-01",
    } as FulfilmentProposal;
    expect(proposalsForMonth([early, elsewhere], 2026, 9)).toEqual([early]);
    expect(proposalsForMonth([early, elsewhere], 2026, 10)).toEqual([early]);
    expect(proposalsForMonth([early, elsewhere], 2026, 11)).toEqual([]);
  });
});

describe("bankForecast", () => {
  const LOAN = "cat-loan";
  // Set up long before any of these occurrences.
  const templates = [
    { id: "tpl-loan", created_at: "2026-01-01T00:00:00Z" },
    { id: "tpl-cover", created_at: "2026-01-01T00:00:00Z" },
    { id: "tpl-salary", created_at: "2026-01-01T00:00:00Z" },
  ];
  const loan = occurrence({
    templateId: "tpl-loan",
    occurredOn: "2026-10-05",
    amount: 909.23,
    categoryId: LOAN,
  });
  const cover = occurrence({
    templateId: "tpl-cover",
    occurredOn: "2026-10-06",
    amount: 23.67,
    categoryId: LOAN,
  });
  const forecastOn = (
    today: string,
    movements: FulfilmentMovement[] = [],
    occurrences: FulfilmentOccurrence[] = [loan, cover],
  ) =>
    bankForecast(
      templates,
      occurrences,
      proposeFulfilments(occurrences, movements, { today }),
      today,
    );

  it("awaits an occurrence whose day has come until the bank brings it", () => {
    expect([...forecastOn("2026-10-05").awaited]).toEqual([
      "tpl-loan:2026-10-05",
    ]);

    const brought = forecastOn("2026-10-05", [
      movement({
        transactionId: "tx-loan",
        occurredOn: "2026-10-05",
        amount: 909.23,
        categoryId: LOAN,
      }),
    ]);
    expect([...brought.awaited]).toEqual([]);
    expect([...brought.arrived]).toEqual(["tpl-loan:2026-10-05"]);
  });

  it("awaits each of a loan's two debits on its own", () => {
    // The payment has come on the 5th; the insurance is due on the 6th and
    // the bank has not brought it on the 7th.
    const result = forecastOn("2026-10-07", [
      movement({
        transactionId: "tx-loan",
        occurredOn: "2026-10-05",
        amount: 909.23,
        categoryId: LOAN,
      }),
    ]);
    expect([...result.arrived]).toEqual(["tpl-loan:2026-10-05"]);
    expect([...result.awaited]).toEqual(["tpl-cover:2026-10-06"]);
  });

  it("stops forecasting one the bank brought before its day", () => {
    const result = forecastOn("2026-10-03", [
      movement({
        transactionId: "tx-cover",
        occurredOn: "2026-10-02",
        amount: 23.67,
        categoryId: LOAN,
      }),
    ]);
    expect([...result.arrived]).toEqual(["tpl-cover:2026-10-06"]);
    expect([...result.awaited]).toEqual([]);
  });

  it("gives up once no movement could be offered for it any more", () => {
    // Four days for a charge.
    expect(forecastOn("2026-10-09", [], [loan]).awaited.size).toBe(1);
    expect(forecastOn("2026-10-10", [], [loan]).awaited.size).toBe(0);

    // Ten for a salary, which moves.
    const salary = occurrence({
      templateId: "tpl-salary",
      occurredOn: "2026-09-30",
      amount: 3400,
      categoryId: SALARY_CATEGORY,
      categoryType: "income",
      recurrence: "monthly",
    });
    expect(forecastOn("2026-10-10", [], [salary]).awaited.size).toBe(1);
    expect(forecastOn("2026-10-11", [], [salary]).awaited.size).toBe(0);
  });

  it("does not await one from before its template was set up", () => {
    const result = bankForecast(
      [{ id: "tpl-loan", created_at: "2026-10-06T08:00:00Z" }],
      [loan],
      [],
      "2026-10-06",
    );
    expect(result.awaited.size).toBe(0);
  });
});
